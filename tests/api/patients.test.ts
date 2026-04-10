/**
 * @file tests/api/patients.test.ts
 * @description Comprehensive tests for Patients API routes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  default: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    patient: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  },
}))

vi.mock('@/lib/api-permissions', () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
  getUserAllowedLocations: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/hipaaHeaders', () => ({
  HIPAA_HEADERS: { 'x-content-type-options': 'nosniff' },
}))

vi.mock('@/lib/auth/session', () => ({
  verifySession: vi.fn().mockResolvedValue({ id: 'user-1', role: 'admin' }),
}))

// ── Helpers ────────────────────────────────────────────────────────────────
function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ── Globals ────────────────────────────────────────────────────────────────
let GET: (req: Request) => Promise<Response>
let POST: (req: Request) => Promise<Response>
let GET_ID: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let PUT_ID: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let requirePermission: ReturnType<typeof vi.fn>
let mockPrisma: {
  $queryRawUnsafe: ReturnType<typeof vi.fn>
  patient: {
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
  }
  auditLog: { create: ReturnType<typeof vi.fn> }
}

beforeEach(async () => {
  vi.clearAllMocks()

  const patientsRoute = await import('@/app/api/patients/route')
  const patientIdRoute = await import('@/app/api/patients/[id]/route')
  const perms = await import('@/lib/api-permissions')
  const db = await import('@/lib/db')

  GET = patientsRoute.GET as unknown as (req: Request) => Promise<Response>
  POST = patientsRoute.POST as unknown as (req: Request) => Promise<Response>
  GET_ID = patientIdRoute.GET as unknown as (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
  PUT_ID = patientIdRoute.PUT as unknown as (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
  requirePermission = perms.requirePermission as ReturnType<typeof vi.fn>
  mockPrisma = db.default as unknown as typeof mockPrisma
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/patients
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/patients', () => {
  it('returns 401 without auth', async () => {
    const { NextResponse } = await import('next/server')
    requirePermission.mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
    const req = makeRequest('GET', 'http://localhost/api/patients')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns patient list', async () => {
    const mockPatients = [
      { id: 'p-1', patientId: 'PAT-ABC', name: 'John Doe', dob: '1990-01-01', status: 'active' },
      { id: 'p-2', patientId: 'PAT-DEF', name: 'Jane Doe', dob: '1985-05-15', status: 'active' },
    ]
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(mockPatients)

    const req = makeRequest('GET', 'http://localhost/api/patients')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(mockPatients)
    expect(json).toHaveLength(2)
  })

  it('filters by locationId', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/patients?locationId=loc-1')
    await GET(req)

    const call = mockPrisma.$queryRawUnsafe.mock.calls[0]
    expect(call[0]).toContain('locationId')
    expect(call).toContain('loc-1')
  })

  it('filters by practiceId', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/patients?practiceId=prac-1')
    await GET(req)

    const call = mockPrisma.$queryRawUnsafe.mock.calls[0]
    expect(call[0]).toContain('practiceId')
    expect(call).toContain('prac-1')
  })

  it('searches by name', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
      { id: 'p-1', name: 'John Doe' },
    ])

    const req = makeRequest('GET', 'http://localhost/api/patients?search=John')
    await GET(req)

    const call = mockPrisma.$queryRawUnsafe.mock.calls[0]
    expect(call[0]).toContain('LIKE')
    expect(call.some((v: unknown) => typeof v === 'string' && v.includes('John'))).toBe(true)
  })

  it('searches by email', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/patients?search=patient@example.com')
    await GET(req)

    const call = mockPrisma.$queryRawUnsafe.mock.calls[0]
    expect(call[0]).toContain('email')
  })

  it('returns empty array when no results', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/patients?search=ZZZnonexistent')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/patients
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/patients', () => {
  it('returns 401 without auth', async () => {
    const { NextResponse } = await import('next/server')
    requirePermission.mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
    const req = makeRequest('POST', 'http://localhost/api/patients', {
      name: 'Test Patient', dob: '1990-01-01',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('creates patient with required fields', async () => {
    const createdPatient = {
      id: 'internal-1',
      patientId: 'PAT-3K9Q',
      name: 'Alice Smith',
      dob: new Date('1992-03-15'),
    }
    mockPrisma.patient.create.mockResolvedValueOnce(createdPatient)
    mockPrisma.auditLog.create.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/patients', {
      name: 'Alice Smith',
      dob: '1992-03-15',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.name).toBe('Alice Smith')
    expect(json.patientId).toBeDefined()
  })

  it('returns 400 if name missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/patients', {
      dob: '1990-01-01',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    // Zod error may say 'Invalid input: expected string, received undefined'
    expect(json.error).toBeTruthy()
  })

  it('returns 400 if dob missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/patients', {
      name: 'Test Patient',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeTruthy()
  })

  it('patient ID format is PAT-XXXXXXXX', async () => {
    const createdPatient = {
      id: 'internal-2',
      patientId: 'PAT-M1N2O3P4',
      name: 'Bob Jones',
      dob: new Date('1980-06-20'),
    }
    mockPrisma.patient.create.mockResolvedValueOnce(createdPatient)
    mockPrisma.auditLog.create.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/patients', {
      name: 'Bob Jones',
      dob: '1980-06-20',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(json.patientId).toMatch(/^PAT-/)
  })

  it('returns 400 if dob format is invalid', async () => {
    const req = makeRequest('POST', 'http://localhost/api/patients', {
      name: 'Test Patient',
      dob: '01/01/1990', // wrong format, should be YYYY-MM-DD
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/patients/[id]
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/patients/[id]', () => {
  it('returns full patient record', async () => {
    const mockPatient = {
      id: 'p-1',
      patientId: 'PAT-ABC',
      name: 'John Doe',
      dob: new Date('1990-01-01'),
      doctor: null,
      dates: [],
      testResults: [],
      videoActivity: [],
      formActivity: [],
      auditLogs: [],
    }
    mockPrisma.patient.findUnique.mockResolvedValueOnce(mockPatient)

    const req = makeRequest('GET', 'http://localhost/api/patients/p-1')
    const res = await GET_ID(req, makeContext('p-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.patientId).toBe('PAT-ABC')
  })

  it('returns 404 for non-existent patient', async () => {
    mockPrisma.patient.findUnique.mockResolvedValueOnce(null)

    const req = makeRequest('GET', 'http://localhost/api/patients/nonexistent')
    const res = await GET_ID(req, makeContext('nonexistent'))

    expect(res.status).toBe(404)
  })

  it('returns 401 without auth', async () => {
    const { NextResponse } = await import('next/server')
    requirePermission.mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
    const req = makeRequest('GET', 'http://localhost/api/patients/p-1')
    const res = await GET_ID(req, makeContext('p-1'))
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/patients/[id]
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/patients/[id]', () => {
  it('returns 401 without auth', async () => {
    const { NextResponse } = await import('next/server')
    requirePermission.mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
    const req = makeRequest('PUT', 'http://localhost/api/patients/p-1', {
      name: 'Updated Name',
    })
    const res = await PUT_ID(req, makeContext('p-1'))
    expect(res.status).toBe(401)
  })

  it('updates patient fields', async () => {
    const updatedPatient = {
      id: 'p-1',
      patientId: 'PAT-ABC',
      name: 'Updated Name',
      dob: new Date('1990-01-01'),
    }
    mockPrisma.patient.update.mockResolvedValueOnce(updatedPatient)
    mockPrisma.auditLog.create.mockResolvedValueOnce(undefined)

    const req = makeRequest('PUT', 'http://localhost/api/patients/p-1', {
      name: 'Updated Name',
    })
    const res = await PUT_ID(req, makeContext('p-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.name).toBe('Updated Name')
  })

  it('returns 500 (prisma error) for non-existent patient', async () => {
    mockPrisma.patient.update.mockRejectedValueOnce(new Error('Record not found'))

    const req = makeRequest('PUT', 'http://localhost/api/patients/nonexistent', {
      name: 'Updated Name',
    })
    const res = await PUT_ID(req, makeContext('nonexistent'))
    // Prisma update on non-existent throws, returns 500
    expect(res.status).toBe(500)
  })

  it('updates phone number', async () => {
    const updatedPatient = {
      id: 'p-1',
      patientId: 'PAT-ABC',
      name: 'John Doe',
      phone: '555-1234',
    }
    mockPrisma.patient.update.mockResolvedValueOnce(updatedPatient)
    mockPrisma.auditLog.create.mockResolvedValueOnce(undefined)

    const req = makeRequest('PUT', 'http://localhost/api/patients/p-1', {
      phone: '555-1234',
    })
    const res = await PUT_ID(req, makeContext('p-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.phone).toBe('555-1234')
  })
})
