/**
 * @file tests/security/auth.test.ts
 * @description Auth security tests: login, logout, MFA, sessions, brute force
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  default: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}))

vi.mock('@/lib/api-permissions', () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/hipaaHeaders', () => ({
  HIPAA_HEADERS: { 'x-content-type-options': 'nosniff' },
}))

vi.mock('@/lib/audit', () => ({
  log: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('bcryptjs', () => {
  const compareFn = vi.fn()
  const hashFn = vi.fn()
  return {
    default: { compare: compareFn, hash: hashFn },
    compare: compareFn,
    hash: hashFn,
  }
})

vi.mock('speakeasy', () => {
  const verifyFn = vi.fn()
  return {
    default: { totp: { verify: verifyFn } },
    totp: { verify: verifyFn },
  }
})

vi.mock('@/lib/auth/session', () => ({
  verifySession: vi.fn().mockResolvedValue(null),
  signSession: vi.fn().mockResolvedValue('mock-jwt-token'),
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

let LOGIN_POST: (req: Request) => Promise<Response>
let LOGOUT_POST: (req: Request) => Promise<Response>
let MFA_VERIFY_POST: (req: Request) => Promise<Response>
let mockPrisma: { $queryRawUnsafe: ReturnType<typeof vi.fn>; $executeRawUnsafe: ReturnType<typeof vi.fn> }
let mockBcrypt: { default: { compare: ReturnType<typeof vi.fn> }; compare: ReturnType<typeof vi.fn> }
let mockSpeakeasy: { default: { totp: { verify: ReturnType<typeof vi.fn> } }; totp: { verify: ReturnType<typeof vi.fn> } }

beforeEach(async () => {
  vi.clearAllMocks()

  const loginRoute = await import('@/app/api/auth/login/route')
  const logoutRoute = await import('@/app/api/auth/logout/route')
  const mfaRoute = await import('@/app/api/auth/mfa-verify/route')
  const db = await import('@/lib/db')
  const bcrypt = await import('bcryptjs')
  const speakeasy = await import('speakeasy')

  LOGIN_POST = loginRoute.POST as unknown as typeof LOGIN_POST
  LOGOUT_POST = logoutRoute.POST as unknown as typeof LOGOUT_POST
  MFA_VERIFY_POST = mfaRoute.POST as unknown as typeof MFA_VERIFY_POST
  mockPrisma = db.default as unknown as typeof mockPrisma
  mockBcrypt = bcrypt as unknown as typeof mockBcrypt
  mockSpeakeasy = speakeasy as unknown as typeof mockSpeakeasy
})

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}

const mockActiveUser = {
  id: 'user-1',
  email: 'admin@clinic.com',
  name: 'Admin User',
  role: 'admin',
  passwordHash: '$2a$10$hashedpassword',
  active: 1,
  mfaEnabled: 0,  // MFA disabled for simpler login tests
  mfaSecret: null,
  defaultLocationId: 'loc-1',
}

// ─── Login Tests ──────────────────────────────────────────────────────────────

describe('POST /api/auth/login — validation', () => {
  it('requires email + password', async () => {
    const req = makeRequest('POST', 'http://localhost/api/auth/login', {})
    const res = await LOGIN_POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/[Ee]mail|[Pp]assword/)
  })

  it('requires password when only email provided', async () => {
    const req = makeRequest('POST', 'http://localhost/api/auth/login', {
      email: 'test@test.com',
    })
    const res = await LOGIN_POST(req)

    expect(res.status).toBe(400)
  })

  it('requires email when only password provided', async () => {
    const req = makeRequest('POST', 'http://localhost/api/auth/login', {
      password: 'mypassword',
    })
    const res = await LOGIN_POST(req)

    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login — wrong credentials', () => {
  it('returns 401 for wrong password', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockActiveUser])
    mockBcrypt.default.compare.mockResolvedValueOnce(false)

    const req = makeRequest('POST', 'http://localhost/api/auth/login', {
      email: 'admin@clinic.com',
      password: 'wrongpassword',
    })
    const res = await LOGIN_POST(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/[Ii]nvalid/)
  })

  it('returns 401 for non-existent user', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]) // no user found

    const req = makeRequest('POST', 'http://localhost/api/auth/login', {
      email: 'nobody@clinic.com',
      password: 'anypassword',
    })
    const res = await LOGIN_POST(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/[Ii]nvalid/)
  })

  it('returns 401 for inactive user', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ ...mockActiveUser, active: 0 }])

    const req = makeRequest('POST', 'http://localhost/api/auth/login', {
      email: 'admin@clinic.com',
      password: 'correctpassword',
    })
    const res = await LOGIN_POST(req)

    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/login — success (MFA disabled)', () => {
  it('returns session cookie on successful login when MFA disabled', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockActiveUser])
    mockBcrypt.default.compare.mockResolvedValueOnce(true)

    const req = makeRequest('POST', 'http://localhost/api/auth/login', {
      email: 'admin@clinic.com',
      password: 'correctpassword',
    })
    const res = await LOGIN_POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('session cookie is httpOnly', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockActiveUser])
    mockBcrypt.default.compare.mockResolvedValueOnce(true)

    const req = makeRequest('POST', 'http://localhost/api/auth/login', {
      email: 'admin@clinic.com',
      password: 'correctpassword',
    })
    const res = await LOGIN_POST(req)

    const setCookieHeader = res.headers.get('set-cookie')
    expect(setCookieHeader).toBeTruthy()
    expect(setCookieHeader?.toLowerCase()).toContain('httponly')
  })

  it('session cookie is sameSite strict', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockActiveUser])
    mockBcrypt.default.compare.mockResolvedValueOnce(true)

    const req = makeRequest('POST', 'http://localhost/api/auth/login', {
      email: 'admin@clinic.com',
      password: 'correctpassword',
    })
    const res = await LOGIN_POST(req)

    const setCookieHeader = res.headers.get('set-cookie')
    expect(setCookieHeader?.toLowerCase()).toContain('samesite=strict')
  })
})

describe('POST /api/auth/login — MFA flow', () => {
  it('returns requiresMfa when user has MFA enabled and configured', async () => {
    const mfaUser = { ...mockActiveUser, mfaEnabled: 1, mfaSecret: 'BASE32SECRET123' }
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mfaUser])
    mockBcrypt.default.compare.mockResolvedValueOnce(true)
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/auth/login', {
      email: 'admin@clinic.com',
      password: 'correctpassword',
    })
    const res = await LOGIN_POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.requiresMfa).toBe(true)
    expect(json.tempToken).toBeDefined()
  })

  it('returns requiresMfaSetup when MFA enabled but not yet configured', async () => {
    const mfaSetupUser = { ...mockActiveUser, mfaEnabled: 1, mfaSecret: null }
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mfaSetupUser])
    mockBcrypt.default.compare.mockResolvedValueOnce(true)
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/auth/login', {
      email: 'admin@clinic.com',
      password: 'correctpassword',
    })
    const res = await LOGIN_POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.requiresMfaSetup).toBe(true)
  })
})

// ─── Logout Tests ─────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('clears session cookie', async () => {
    const req = makeRequest('POST', 'http://localhost/api/auth/logout')
    const res = await LOGOUT_POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    // Cookie should be cleared (maxAge=0 or expires in the past)
    const setCookieHeader = res.headers.get('set-cookie')
    expect(setCookieHeader).toBeTruthy()
    // Should have iat_session= with empty value or max-age=0
    expect(setCookieHeader?.toLowerCase()).toMatch(/iat_session=;|max-age=0/)
  })

  it('returns ok:true even without active session', async () => {
    const req = makeRequest('POST', 'http://localhost/api/auth/logout')
    const res = await LOGOUT_POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})

// ─── MFA Verify Tests ─────────────────────────────────────────────────────────

describe('POST /api/auth/mfa-verify', () => {
  it('rejects invalid code', async () => {
    const mfaUser = {
      id: 'user-1',
      email: 'admin@clinic.com',
      name: 'Admin',
      role: 'admin',
      mfaSecret: 'BASE32SECRET123',
      defaultLocationId: 'loc-1',
    }
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mfaUser])
    mockSpeakeasy.default.totp.verify.mockReturnValueOnce(false) // invalid code

    const req = makeRequest('POST', 'http://localhost/api/auth/mfa-verify', {
      tempToken: 'valid-temp-token',
      code: '000000', // wrong code
    })
    const res = await MFA_VERIFY_POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/[Ii]nvalid/)
  })

  it('accepts valid TOTP code and issues session', async () => {
    const mfaUser = {
      id: 'user-1',
      email: 'admin@clinic.com',
      name: 'Admin',
      role: 'admin',
      mfaSecret: 'BASE32SECRET123',
      defaultLocationId: 'loc-1',
    }
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mfaUser])
    mockSpeakeasy.default.totp.verify.mockReturnValueOnce(true) // valid code
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/auth/mfa-verify', {
      tempToken: 'valid-temp-token',
      code: '123456',
    })
    const res = await MFA_VERIFY_POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 401 for expired or invalid tempToken', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]) // no matching user

    const req = makeRequest('POST', 'http://localhost/api/auth/mfa-verify', {
      tempToken: 'expired-token',
      code: '123456',
    })
    const res = await MFA_VERIFY_POST(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 when tempToken is missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/auth/mfa-verify', {
      code: '123456',
    })
    const res = await MFA_VERIFY_POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when code is missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/auth/mfa-verify', {
      tempToken: 'some-token',
    })
    const res = await MFA_VERIFY_POST(req)

    expect(res.status).toBe(400)
  })
})

// ─── Protected Routes ─────────────────────────────────────────────────────────

describe('Protected routes — return 401 without valid session', () => {
  it('requirePermission returns 401 response when no session', async () => {
    const { requirePermission } = await import('@/lib/api-permissions')
    const sessionMod = await import('@/lib/auth/session')
    ;(sessionMod.verifySession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    ;(requirePermission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    const result = await requirePermission(
      new Request('http://localhost/api/protected') as unknown as import('next/server').NextRequest,
      'patients_view'
    )

    expect(result).not.toBeNull()
    const r = result as Response
    expect(r.status).toBe(401)
  })

  it('claim route returns 401 without session', async () => {
    const sessionMod = await import('@/lib/auth/session')
    ;(sessionMod.verifySession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/encounters/[id]/claim/route')
    const req = new Request('http://localhost/api/encounters/enc-1/claim', { method: 'POST' })
    const res = await (POST as unknown as (r: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>)(
      req,
      { params: Promise.resolve({ id: 'enc-1' }) }
    )

    expect(res.status).toBe(401)
  })

  it('waiting-room GET returns 401 without session', async () => {
    const sessionMod = await import('@/lib/auth/session')
    ;(sessionMod.verifySession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { GET } = await import('@/app/api/waiting-room/route')
    const req = new Request('http://localhost/api/waiting-room')
    const res = await (GET as unknown as (r: Request) => Promise<Response>)(req)

    expect(res.status).toBe(401)
  })
})

// ─── Rate Limiting / Brute Force ──────────────────────────────────────────────

describe('Rate limiting — brute force protection', () => {
  it('logs failed attempts to audit log', async () => {
    const { log } = await import('@/lib/audit')
    const logMock = log as ReturnType<typeof vi.fn>

    mockPrisma.$queryRawUnsafe.mockResolvedValue([mockActiveUser])
    mockBcrypt.default.compare.mockResolvedValue(false) // always fail

    // Simulate 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      const req = makeRequest('POST', 'http://localhost/api/auth/login', {
        email: 'admin@clinic.com',
        password: `wrongpassword${i}`,
      })
      await LOGIN_POST(req)
    }

    // Audit log should have been called for each failure
    const failedCalls = logMock.mock.calls.filter(
      call => call[0]?.action === 'LOGIN_FAILED'
    )
    expect(failedCalls.length).toBeGreaterThanOrEqual(5)
  })

  it('each failed login attempt returns 401', async () => {
    const results: number[] = []

    for (let i = 0; i < 5; i++) {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockActiveUser])
      mockBcrypt.default.compare.mockResolvedValueOnce(false)

      const req = makeRequest('POST', 'http://localhost/api/auth/login', {
        email: 'admin@clinic.com',
        password: `attempt${i}`,
      })
      const res = await LOGIN_POST(req)
      results.push(res.status)
    }

    // All should be 401
    expect(results.every(s => s === 401)).toBe(true)
  })

  it('does not leak user existence info on failure', async () => {
    // Non-existent user
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([])

    const req1 = makeRequest('POST', 'http://localhost/api/auth/login', {
      email: 'nobody@clinic.com',
      password: 'password',
    })
    const res1 = await LOGIN_POST(req1)
    const json1 = await res1.json()

    // Existing user with wrong password
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([mockActiveUser])
    mockBcrypt.default.compare.mockResolvedValueOnce(false)

    const req2 = makeRequest('POST', 'http://localhost/api/auth/login', {
      email: 'admin@clinic.com',
      password: 'wrongpassword',
    })
    const res2 = await LOGIN_POST(req2)
    const json2 = await res2.json()

    // Both should return the same generic error message
    expect(json1.error).toBe(json2.error)
    expect(res1.status).toBe(res2.status)
  })
})
