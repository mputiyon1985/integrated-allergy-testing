/**
 * @file tests/api/claim.test.ts
 * @description Tests for POST /api/encounters/[id]/claim — Claim generation
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

vi.mock('@/lib/auth/session', () => ({
  verifySession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  log: vi.fn().mockResolvedValue(undefined),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let mockPrisma: { $queryRawUnsafe: ReturnType<typeof vi.fn>; $executeRawUnsafe: ReturnType<typeof vi.fn> }
let mockVerifySession: ReturnType<typeof vi.fn>

beforeEach(async () => {
  vi.clearAllMocks()

  const route = await import('@/app/api/encounters/[id]/claim/route')
  const db = await import('@/lib/db')
  const sessionMod = await import('@/lib/auth/session')

  POST = route.POST as unknown as typeof POST
  mockPrisma = db.default as unknown as typeof mockPrisma
  mockVerifySession = sessionMod.verifySession as ReturnType<typeof vi.fn>
})

function makeRequest(body?: unknown): Request {
  return new Request('http://localhost/api/encounters/enc-123/claim', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

const mockEncounter = {
  id: 'enc-123',
  patientId: 'pat-001',
  status: 'signed',
  encounterDate: '2024-06-01',
  doctorName: 'Dr. Smith',
  diagnosisCode: 'J30.1',
  cptSummary: JSON.stringify([
    { code: '95004', description: 'Allergy skin test', units: 10, fee: 15.00, total: 150.00 },
    { code: '95165', description: 'Immunotherapy', units: 1, fee: 75.00, total: 75.00 },
  ]),
}

const mockPatient = {
  id: 'pat-001',
  name: 'Jane Doe',
  dob: '1990-05-15',
  patientId: 'PT-00001',
  insuranceProvider: 'BlueCross BlueShield',
  insuranceId: 'BCB-123456',
  insuranceGroup: 'GRP-99',
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/encounters/[id]/claim — Returns 401 without auth', () => {
  it('returns 401 when no session', async () => {
    mockVerifySession.mockResolvedValueOnce(null)

    const req = makeRequest()
    const res = await POST(req, makeContext('enc-123'))

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/[Uu]nauthorized/)
  })
})

describe('POST /api/encounters/[id]/claim — Returns 404 for non-existent encounter', () => {
  it('returns 404 when encounter not found', async () => {
    mockVerifySession.mockResolvedValueOnce({ userId: 'user-1', role: 'admin' })
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]) // no encounter

    const req = makeRequest()
    const res = await POST(req, makeContext('nonexistent'))

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/[Nn]ot [Ff]ound/)
  })
})

describe('POST /api/encounters/[id]/claim — Returns 400 if encounter not signed/billed', () => {
  it('returns 400 for open encounter', async () => {
    mockVerifySession.mockResolvedValueOnce({ userId: 'user-1', role: 'admin' })
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ ...mockEncounter, status: 'open' }])

    const req = makeRequest()
    const res = await POST(req, makeContext('enc-123'))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/signed|billed/i)
  })

  it('returns 400 for complete encounter', async () => {
    mockVerifySession.mockResolvedValueOnce({ userId: 'user-1', role: 'admin' })
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ ...mockEncounter, status: 'complete' }])

    const req = makeRequest()
    const res = await POST(req, makeContext('enc-123'))

    expect(res.status).toBe(400)
  })
})

describe('POST /api/encounters/[id]/claim — Returns claim object with required fields', () => {
  it('returns claim with required fields', async () => {
    mockVerifySession.mockResolvedValueOnce({ userId: 'user-1', role: 'admin' })
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([mockEncounter])
      .mockResolvedValueOnce([mockPatient])

    const req = makeRequest()
    const res = await POST(req, makeContext('enc-123'))

    expect(res.status).toBe(200)
    const claim = await res.json()

    expect(claim.claimId).toBeDefined()
    expect(claim.encounterId).toBe('enc-123')
    expect(claim.patientName).toBe('Jane Doe')
    expect(claim.dateOfService).toBeDefined()
    expect(claim.diagnosisCodes).toBeDefined()
    expect(claim.cptCodes).toBeDefined()
    expect(claim.totalCharges).toBeDefined()
  })

  it('claimId format starts with CLM-', async () => {
    mockVerifySession.mockResolvedValueOnce({ userId: 'user-1', role: 'admin' })
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([mockEncounter])
      .mockResolvedValueOnce([mockPatient])

    const req = makeRequest()
    const res = await POST(req, makeContext('enc-123'))
    const claim = await res.json()

    expect(claim.claimId).toMatch(/^CLM-/)
  })

  it('includes patient insurance info', async () => {
    mockVerifySession.mockResolvedValueOnce({ userId: 'user-1', role: 'admin' })
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([mockEncounter])
      .mockResolvedValueOnce([mockPatient])

    const req = makeRequest()
    const res = await POST(req, makeContext('enc-123'))
    const claim = await res.json()

    expect(claim.insuranceProvider).toBe('BlueCross BlueShield')
    expect(claim.memberId).toBe('BCB-123456')
    expect(claim.groupNumber).toBe('GRP-99')
  })

  it('includes provider NPI', async () => {
    mockVerifySession.mockResolvedValueOnce({ userId: 'user-1', role: 'admin' })
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([mockEncounter])
      .mockResolvedValueOnce([mockPatient])

    const req = makeRequest()
    const res = await POST(req, makeContext('enc-123'))
    const claim = await res.json()

    expect(claim.renderingProviderNPI).toBeDefined()
    expect(typeof claim.renderingProviderNPI).toBe('string')
  })

  it('totalCharges calculated from cptSummary JSON', async () => {
    mockVerifySession.mockResolvedValueOnce({ userId: 'user-1', role: 'admin' })
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([mockEncounter])
      .mockResolvedValueOnce([mockPatient])

    const req = makeRequest()
    const res = await POST(req, makeContext('enc-123'))
    const claim = await res.json()

    // 150.00 + 75.00 = 225.00
    expect(claim.totalCharges).toBe(225.00)
  })

  it('handles billed status too', async () => {
    mockVerifySession.mockResolvedValueOnce({ userId: 'user-1', role: 'admin' })
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ ...mockEncounter, status: 'billed' }])
      .mockResolvedValueOnce([mockPatient])

    const req = makeRequest()
    const res = await POST(req, makeContext('enc-123'))

    expect(res.status).toBe(200)
    const claim = await res.json()
    expect(claim.claimId).toMatch(/^CLM-/)
  })

  it('diagnosisCodes includes encounter diagnosisCode', async () => {
    mockVerifySession.mockResolvedValueOnce({ userId: 'user-1', role: 'admin' })
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([mockEncounter])
      .mockResolvedValueOnce([mockPatient])

    const req = makeRequest()
    const res = await POST(req, makeContext('enc-123'))
    const claim = await res.json()

    expect(Array.isArray(claim.diagnosisCodes)).toBe(true)
    expect(claim.diagnosisCodes).toContain('J30.1')
  })

  it('totalCharges is 0 when no cptSummary', async () => {
    mockVerifySession.mockResolvedValueOnce({ userId: 'user-1', role: 'admin' })
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ ...mockEncounter, cptSummary: null }])
      .mockResolvedValueOnce([mockPatient])

    const req = makeRequest()
    const res = await POST(req, makeContext('enc-123'))
    const claim = await res.json()

    expect(claim.totalCharges).toBe(0)
  })
})
