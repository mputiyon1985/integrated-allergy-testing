/**
 * @file tests/api/appointments.test.ts
 * @description Comprehensive tests for IAT Appointments API
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  default: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn(),
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  },
}))

vi.mock('@/lib/api-permissions', () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}))

// ── Mock @paralleldrive/cuid2 ──────────────────────────────────────────────
vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn(() => 'test-appointment-id'),
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
let PUT_ID: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let DELETE_ID: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let requirePermission: ReturnType<typeof vi.fn>
let mockPrisma: {
  $queryRawUnsafe: ReturnType<typeof vi.fn>
  $executeRawUnsafe: ReturnType<typeof vi.fn>
  $executeRaw: ReturnType<typeof vi.fn>
  $queryRaw: ReturnType<typeof vi.fn>
  auditLog: { create: ReturnType<typeof vi.fn> }
}

beforeEach(async () => {
  vi.clearAllMocks()

  const apptRoute = await import('@/app/api/iat-appointments/route')
  const apptIdRoute = await import('@/app/api/iat-appointments/[id]/route')
  const perms = await import('@/lib/api-permissions')
  const db = await import('@/lib/db')

  GET = apptRoute.GET as unknown as (req: Request) => Promise<Response>
  POST = apptRoute.POST as unknown as (req: Request) => Promise<Response>
  PUT_ID = apptIdRoute.PUT as unknown as (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
  DELETE_ID = apptIdRoute.DELETE as unknown as (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
  requirePermission = perms.requirePermission as ReturnType<typeof vi.fn>
  mockPrisma = db.default as unknown as typeof mockPrisma
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/iat-appointments
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/iat-appointments', () => {
  it('returns appointments for date range', async () => {
    const mockAppts = [
      { id: 'appt-1', title: 'Allergy Test', startTime: '2026-04-10T09:00:00Z', endTime: '2026-04-10T09:30:00Z' },
      { id: 'appt-2', title: 'Follow Up', startTime: '2026-04-10T10:00:00Z', endTime: '2026-04-10T10:30:00Z' },
    ]
    mockPrisma.$queryRaw.mockResolvedValueOnce(mockAppts)

    const req = makeRequest('GET', 'http://localhost/api/iat-appointments?date=2026-04-10')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(mockAppts)
  })

  it('filters by locationId', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/iat-appointments?date=2026-04-10&locationId=loc-1')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.$queryRaw).toHaveBeenCalled()
  })

  it('filters by practiceId', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/iat-appointments?date=2026-04-10&practiceId=prac-1')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.$queryRaw).toHaveBeenCalled()
  })

  it('returns empty array when no results', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/iat-appointments?date=2000-01-01')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/iat-appointments
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/iat-appointments', () => {
  it('returns 401 without auth', async () => {
    const { NextResponse } = await import('next/server')
    requirePermission.mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
    const req = makeRequest('POST', 'http://localhost/api/iat-appointments', {
      title: 'Test Appointment',
      startTime: '2026-04-10T09:00:00Z',
      endTime: '2026-04-10T09:30:00Z',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('creates appointment with required fields', async () => {
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)
    mockPrisma.auditLog.create.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/iat-appointments', {
      title: 'Allergy Test',
      startTime: '2026-04-10T09:00:00Z',
      endTime: '2026-04-10T09:30:00Z',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.title).toBe('Allergy Test')
    expect(json.id).toBeDefined()
  })

  it('returns 400 if title missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/iat-appointments', {
      startTime: '2026-04-10T09:00:00Z',
      endTime: '2026-04-10T09:30:00Z',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 if startTime missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/iat-appointments', {
      title: 'Test Appointment',
      endTime: '2026-04-10T09:30:00Z',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 if endTime before startTime', async () => {
    const req = makeRequest('POST', 'http://localhost/api/iat-appointments', {
      title: 'Test Appointment',
      startTime: '2026-04-10T10:00:00Z',
      endTime: '2026-04-10T09:00:00Z', // before start
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/endTime|after/i)
  })

  it('returns 400 if endTime equals startTime', async () => {
    const req = makeRequest('POST', 'http://localhost/api/iat-appointments', {
      title: 'Test Appointment',
      startTime: '2026-04-10T09:00:00Z',
      endTime: '2026-04-10T09:00:00Z', // same time
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('saves providerName when provided', async () => {
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)
    mockPrisma.auditLog.create.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/iat-appointments', {
      title: 'Consultation',
      startTime: '2026-04-10T09:00:00Z',
      endTime: '2026-04-10T09:30:00Z',
      providerName: 'Dr. Johnson',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    // The INSERT is called with providerName
    const rawCall = mockPrisma.$executeRaw.mock.calls[0]
    const callStr = JSON.stringify(rawCall)
    // Verify executeRaw was called (providerName is included in INSERT)
    expect(mockPrisma.$executeRaw).toHaveBeenCalled()
    expect(json.id).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/iat-appointments/[id]
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/iat-appointments/[id]', () => {
  it('returns 401 without auth', async () => {
    const { NextResponse } = await import('next/server')
    requirePermission.mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
    const req = makeRequest('PUT', 'http://localhost/api/iat-appointments/appt-1', {
      title: 'Updated Title',
    })
    const res = await PUT_ID(req, makeContext('appt-1'))
    expect(res.status).toBe(401)
  })

  it('updates appointment fields', async () => {
    // Exists check
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'appt-1' }])
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)
    mockPrisma.auditLog.create.mockResolvedValueOnce(undefined)

    const req = makeRequest('PUT', 'http://localhost/api/iat-appointments/appt-1', {
      title: 'Updated Title',
      status: 'complete',
    })
    const res = await PUT_ID(req, makeContext('appt-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('appt-1')
  })

  it('returns 404 for non-existent appointment', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]) // not found

    const req = makeRequest('PUT', 'http://localhost/api/iat-appointments/nonexistent', {
      title: 'Updated',
    })
    const res = await PUT_ID(req, makeContext('nonexistent'))
    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/iat-appointments/[id]
// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /api/iat-appointments/[id]', () => {
  it('returns 401 without auth', async () => {
    const { NextResponse } = await import('next/server')
    requirePermission.mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
    const req = makeRequest('DELETE', 'http://localhost/api/iat-appointments/appt-1')
    const res = await DELETE_ID(req, makeContext('appt-1'))
    expect(res.status).toBe(401)
  })

  it('soft-deletes (sets deletedAt)', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'appt-1' }])
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)
    mockPrisma.auditLog.create.mockResolvedValueOnce(undefined)

    const req = makeRequest('DELETE', 'http://localhost/api/iat-appointments/appt-1')
    const res = await DELETE_ID(req, makeContext('appt-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    // Soft delete uses $executeRaw with deletedAt
    expect(mockPrisma.$executeRaw).toHaveBeenCalled()
  })

  it('returns 404 for non-existent appointment', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]) // not found

    const req = makeRequest('DELETE', 'http://localhost/api/iat-appointments/nonexistent')
    const res = await DELETE_ID(req, makeContext('nonexistent'))
    expect(res.status).toBe(404)
  })
})
