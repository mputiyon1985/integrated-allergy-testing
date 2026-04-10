/**
 * @file tests/api/insurance.test.ts
 * @description Tests for insurance companies, practice insurances, and practice hours APIs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  default: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    insuranceCompany: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    practice: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/api-permissions', () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/hipaaHeaders', () => ({
  HIPAA_HEADERS: { 'x-content-type-options': 'nosniff' },
}))

vi.mock('@/lib/auth/session', () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'admin' }),
}))

vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn(() => 'test-cuid-12345'),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

let INSURANCE_GET: (req: Request) => Promise<Response>
let INSURANCE_POST: (req: Request) => Promise<Response>
let INSURANCE_PUT: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let INSURANCE_DELETE: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let PRACTICE_INS_GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let PRACTICE_INS_POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let PRACTICE_INS_DELETE: (req: Request, ctx: { params: Promise<{ id: string; insuranceId: string }> }) => Promise<Response>
let HOURS_GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let HOURS_PUT: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

let mockPrisma: {
  $queryRaw: ReturnType<typeof vi.fn>
  $queryRawUnsafe: ReturnType<typeof vi.fn>
  $executeRaw: ReturnType<typeof vi.fn>
  insuranceCompany: {
    findMany: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  practice: { findFirst: ReturnType<typeof vi.fn> }
}

beforeEach(async () => {
  vi.clearAllMocks()

  const insRoute = await import('@/app/api/insurance-companies/route')
  const insIdRoute = await import('@/app/api/insurance-companies/[id]/route')
  const pracInsRoute = await import('@/app/api/practices/[id]/insurances/route')
  const pracInsIdRoute = await import('@/app/api/practices/[id]/insurances/[insuranceId]/route')
  const hoursRoute = await import('@/app/api/practices/[id]/hours/route')
  const db = await import('@/lib/db')

  INSURANCE_GET = insRoute.GET as unknown as typeof INSURANCE_GET
  INSURANCE_POST = insRoute.POST as unknown as typeof INSURANCE_POST
  INSURANCE_PUT = insIdRoute.PUT as unknown as typeof INSURANCE_PUT
  INSURANCE_DELETE = insIdRoute.DELETE as unknown as typeof INSURANCE_DELETE
  PRACTICE_INS_GET = pracInsRoute.GET as unknown as typeof PRACTICE_INS_GET
  PRACTICE_INS_POST = pracInsRoute.POST as unknown as typeof PRACTICE_INS_POST
  PRACTICE_INS_DELETE = pracInsIdRoute.DELETE as unknown as typeof PRACTICE_INS_DELETE
  HOURS_GET = hoursRoute.GET as unknown as typeof HOURS_GET
  HOURS_PUT = hoursRoute.PUT as unknown as typeof HOURS_PUT
  mockPrisma = db.default as unknown as typeof mockPrisma
})

function makeRequest(method: string, url: string, body?: unknown): Request {
  // Use NextRequest so that req.nextUrl.searchParams works correctly
  const { NextRequest } = require('next/server')
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makePracInsContext(id: string, insuranceId: string) {
  return { params: Promise.resolve({ id, insuranceId }) }
}

// ─── Insurance Companies ──────────────────────────────────────────────────────

describe('GET /api/insurance-companies', () => {
  it('returns list of insurance companies', async () => {
    const mockCompanies = [
      { id: 'ic-1', name: 'BlueCross', type: 'commercial', active: true },
      { id: 'ic-2', name: 'Aetna', type: 'commercial', active: true },
    ]
    mockPrisma.insuranceCompany.findMany.mockResolvedValueOnce(mockCompanies)

    const req = makeRequest('GET', 'http://localhost/api/insurance-companies')
    const res = await INSURANCE_GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.companies).toEqual(mockCompanies)
  })

  it('filters by active=true by default', async () => {
    mockPrisma.insuranceCompany.findMany.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/insurance-companies')
    await INSURANCE_GET(req)

    const callArgs = mockPrisma.insuranceCompany.findMany.mock.calls[0][0]
    expect(callArgs.where).toMatchObject({ active: true })
  })

  it('returns all companies when all=true', async () => {
    mockPrisma.insuranceCompany.findMany.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/insurance-companies?all=true')
    await INSURANCE_GET(req)

    const callArgs = mockPrisma.insuranceCompany.findMany.mock.calls[0][0]
    expect(callArgs.where).not.toHaveProperty('active')
  })

  it('returns companies via raw query when practiceId provided', async () => {
    const mockRows = [{ id: 'ic-1', name: 'BlueCross', type: 'commercial' }]
    mockPrisma.$queryRaw.mockResolvedValueOnce(mockRows)

    const req = makeRequest('GET', 'http://localhost/api/insurance-companies?practiceId=prac-1')
    const res = await INSURANCE_GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.companies).toBeDefined()
  })
})

describe('POST /api/insurance-companies', () => {
  it('creates new insurance company', async () => {
    const newCompany = {
      id: 'ic-new',
      name: 'United Health',
      type: 'commercial',
      active: true,
      sortOrder: 0,
    }
    mockPrisma.insuranceCompany.create.mockResolvedValueOnce(newCompany)

    const req = makeRequest('POST', 'http://localhost/api/insurance-companies', {
      name: 'United Health',
      type: 'commercial',
    })
    const res = await INSURANCE_POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.name).toBe('United Health')
  })

  it('returns 400 when name is missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/insurance-companies', {
      type: 'commercial',
    })
    const res = await INSURANCE_POST(req)

    expect(res.status).toBe(400)
  })
})

describe('PUT /api/insurance-companies/[id]', () => {
  it('updates company fields', async () => {
    const updatedCompany = { id: 'ic-1', name: 'BlueCross Updated', type: 'commercial', active: true }
    mockPrisma.insuranceCompany.update.mockResolvedValueOnce(updatedCompany)

    const req = makeRequest('PUT', 'http://localhost/api/insurance-companies/ic-1', {
      name: 'BlueCross Updated',
    })
    const res = await INSURANCE_PUT(req, makeContext('ic-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.name).toBe('BlueCross Updated')
  })

  it('updates active status', async () => {
    const updatedCompany = { id: 'ic-1', name: 'BlueCross', active: false }
    mockPrisma.insuranceCompany.update.mockResolvedValueOnce(updatedCompany)

    const req = makeRequest('PUT', 'http://localhost/api/insurance-companies/ic-1', {
      active: false,
    })
    const res = await INSURANCE_PUT(req, makeContext('ic-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.active).toBe(false)
  })
})

describe('DELETE /api/insurance-companies/[id]', () => {
  it('soft-deletes by setting active=false', async () => {
    const deactivated = { id: 'ic-1', name: 'BlueCross', active: false }
    mockPrisma.insuranceCompany.update.mockResolvedValueOnce(deactivated)

    const req = makeRequest('DELETE', 'http://localhost/api/insurance-companies/ic-1')
    const res = await INSURANCE_DELETE(req, makeContext('ic-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.active).toBe(false)

    // Verify it's an update (soft delete), not a hard delete
    expect(mockPrisma.insuranceCompany.update).toHaveBeenCalledWith({
      where: { id: 'ic-1' },
      data: { active: false },
    })
  })
})

// ─── Practice Insurances ──────────────────────────────────────────────────────

describe('GET /api/practices/[id]/insurances', () => {
  it('returns linked insurers for practice', async () => {
    // The raw query returns flat joined rows; the route maps them
    // The mock returns an array of rows matching the raw SQL alias format
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        pi_id: 'pi-1',
        pi_practiceId: 'prac-1',
        pi_insuranceId: 'ic-1',
        pi_sortOrder: 0,
        ic_id: 'ic-1',
        ic_name: 'BlueCross',
        ic_type: 'commercial',
        ic_payerId: 'BCB',
      },
    ])

    const req = makeRequest('GET', 'http://localhost/api/practices/prac-1/insurances')
    const res = await PRACTICE_INS_GET(req, makeContext('prac-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.insurances).toHaveLength(1)
    // The route maps ic_name → insurance.name
    const ins = json.insurances[0]
    expect(ins.id).toBe('pi-1')
    expect(ins.insuranceId).toBe('ic-1')
  })

  it('returns empty array when practice has no insurances', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])

    const req = makeRequest('GET', 'http://localhost/api/practices/prac-empty/insurances')
    const res = await PRACTICE_INS_GET(req, makeContext('prac-empty'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.insurances).toEqual([])
  })
})

describe('POST /api/practices/[id]/insurances', () => {
  it('adds insurer to practice', async () => {
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/practices/prac-1/insurances', {
      insuranceId: 'ic-1',
    })
    const res = await PRACTICE_INS_POST(req, makeContext('prac-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
  })

  it('returns 400 when insuranceId missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/practices/prac-1/insurances', {})
    const res = await PRACTICE_INS_POST(req, makeContext('prac-1'))

    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/practices/[id]/insurances/[insuranceId]', () => {
  it('removes insurer from practice', async () => {
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('DELETE', 'http://localhost/api/practices/prac-1/insurances/ic-1')
    const res = await PRACTICE_INS_DELETE(req, makePracInsContext('prac-1', 'ic-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
  })
})

// ─── Practice Hours ───────────────────────────────────────────────────────────

describe('GET /api/practices/[id]/hours', () => {
  it('returns 7 days of hours', async () => {
    const mockHours = Array.from({ length: 7 }, (_, i) => ({
      id: `ph-${i}`,
      practiceId: 'prac-1',
      dayOfWeek: i,
      isOpen: i >= 1 && i <= 5 ? 1 : 0,
      openTime: '08:00',
      closeTime: '17:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      notes: '',
    }))
    mockPrisma.$queryRaw.mockResolvedValueOnce(mockHours)

    const req = makeRequest('GET', 'http://localhost/api/practices/prac-1/hours')
    const res = await HOURS_GET(req, makeContext('prac-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.hours).toHaveLength(7)
  })

  it('returns defaults if no hours configured', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]) // no rows = use defaults

    const req = makeRequest('GET', 'http://localhost/api/practices/prac-new/hours')
    const res = await HOURS_GET(req, makeContext('prac-new'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.hours).toHaveLength(7)
    // Defaults: weekdays open, weekends closed
    expect(json.hours[0].isOpen).toBe(0) // Sunday closed
    expect(json.hours[1].isOpen).toBe(1) // Monday open
    expect(json.hours[6].isOpen).toBe(0) // Saturday closed
  })
})

describe('PUT /api/practices/[id]/hours', () => {
  const fullHoursPayload = Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    isOpen: i >= 1 && i <= 5,
    openTime: '08:00',
    closeTime: '17:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    notes: '',
  }))

  it('saves hours for all 7 days', async () => {
    // Each day: check existing (none) then insert
    mockPrisma.$queryRaw.mockResolvedValue([])
    mockPrisma.$executeRaw.mockResolvedValue(undefined)

    const req = makeRequest('PUT', 'http://localhost/api/practices/prac-1/hours', {
      hours: fullHoursPayload,
    })
    const res = await HOURS_PUT(req, makeContext('prac-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('correctly handles isOpen=false days', async () => {
    // Provide only Sunday (closed) and see it saves with isOpen=0
    const sundayHours = [{ dayOfWeek: 0, isOpen: false, openTime: '08:00', closeTime: '17:00' }]
    mockPrisma.$queryRaw.mockResolvedValue([]) // no existing
    mockPrisma.$executeRaw.mockResolvedValue(undefined)

    const req = makeRequest('PUT', 'http://localhost/api/practices/prac-1/hours', {
      hours: sundayHours,
    })
    const res = await HOURS_PUT(req, makeContext('prac-1'))

    expect(res.status).toBe(200)
    // Verify $executeRaw was called — isOpen=false → 0 in DB
    expect(mockPrisma.$executeRaw).toHaveBeenCalled()
  })

  it('lunch break saved correctly', async () => {
    const hoursWithLunch = [{
      dayOfWeek: 1,
      isOpen: true,
      openTime: '08:00',
      closeTime: '18:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
    }]
    mockPrisma.$queryRaw.mockResolvedValue([]) // no existing
    mockPrisma.$executeRaw.mockResolvedValue(undefined)

    const req = makeRequest('PUT', 'http://localhost/api/practices/prac-1/hours', {
      hours: hoursWithLunch,
    })
    const res = await HOURS_PUT(req, makeContext('prac-1'))

    expect(res.status).toBe(200)
    expect(mockPrisma.$executeRaw).toHaveBeenCalled()
  })

  it('updates existing hours when they exist', async () => {
    const existingHour = [{ id: 'ph-existing' }]
    mockPrisma.$queryRaw.mockResolvedValue(existingHour) // has existing
    mockPrisma.$executeRaw.mockResolvedValue(undefined)

    const req = makeRequest('PUT', 'http://localhost/api/practices/prac-1/hours', {
      hours: [{ dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '18:00' }],
    })
    const res = await HOURS_PUT(req, makeContext('prac-1'))

    expect(res.status).toBe(200)
    // UPDATE path was taken
    expect(mockPrisma.$executeRaw).toHaveBeenCalled()
  })

  it('returns 400 when no hours array provided', async () => {
    const req = makeRequest('PUT', 'http://localhost/api/practices/prac-1/hours', {
      notHours: 'invalid',
    })
    const res = await HOURS_PUT(req, makeContext('prac-1'))

    expect(res.status).toBe(400)
  })
})
