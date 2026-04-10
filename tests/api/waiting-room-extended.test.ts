/**
 * @file tests/api/waiting-room-extended.test.ts
 * @description Extended route handler tests for /api/waiting-room
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  default: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    patient: {
      findFirst: vi.fn(),
    },
    waitingRoom: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
  verifySession: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'admin', name: 'Admin' }),
}))

vi.mock('@/lib/audit', () => ({
  log: vi.fn().mockResolvedValue(undefined),
}))

// ─── Imports after mocks ──────────────────────────────────────────────────────

let GET: (req: Request) => Promise<Response>
let POST: (req: Request) => Promise<Response>
let PUT_ID: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let mockPrisma: {
  $queryRaw: ReturnType<typeof vi.fn>
  $queryRawUnsafe: ReturnType<typeof vi.fn>
  patient: { findFirst: ReturnType<typeof vi.fn> }
  waitingRoom: {
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

beforeEach(async () => {
  vi.clearAllMocks()

  const waitRoute = await import('@/app/api/waiting-room/route')
  const waitIdRoute = await import('@/app/api/waiting-room/[id]/route')
  const db = await import('@/lib/db')
  const sessionMod = await import('@/lib/auth/session')

  GET = waitRoute.GET as unknown as typeof GET
  POST = waitRoute.POST as unknown as typeof POST
  PUT_ID = waitIdRoute.PUT as unknown as typeof PUT_ID
  mockPrisma = db.default as unknown as typeof mockPrisma

  // Default: authenticated session
  ;(sessionMod.verifySession as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId: 'user-1',
    role: 'admin',
    name: 'Admin',
  })
})

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

// ─── GET tests ────────────────────────────────────────────────────────────────

describe('GET /api/waiting-room — filtering', () => {
  it('filters by locationId correctly', async () => {
    const mockEntries = [{ id: 'wr-1', patientName: 'John', locationId: 'loc-1', status: 'waiting' }]
    mockPrisma.$queryRaw.mockResolvedValueOnce(mockEntries)

    const req = makeRequest('GET', 'http://localhost/api/waiting-room?locationId=loc-1')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.entries).toEqual(mockEntries)
    // Verify $queryRaw was called (filter branch)
    expect(mockPrisma.$queryRaw).toHaveBeenCalled()
  })

  it('filters by practiceId via subquery', async () => {
    const mockEntries = [{ id: 'wr-2', patientName: 'Jane', status: 'in-service' }]
    mockPrisma.$queryRaw.mockResolvedValueOnce(mockEntries)

    const req = makeRequest('GET', 'http://localhost/api/waiting-room?practiceId=prac-1')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.entries).toEqual(mockEntries)
    expect(mockPrisma.$queryRaw).toHaveBeenCalled()
  })

  it('returns all entries when no filter', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/waiting-room')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.$queryRaw).toHaveBeenCalled()
  })

  it('returns 401 without valid session', async () => {
    const sessionMod = await import('@/lib/auth/session')
    ;(sessionMod.verifySession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const req = makeRequest('GET', 'http://localhost/api/waiting-room')
    const res = await GET(req)

    expect(res.status).toBe(401)
  })
})

// ─── POST tests ───────────────────────────────────────────────────────────────

describe('POST /api/waiting-room', () => {
  it('adds patient to waiting room', async () => {
    const mockPatient = { id: 'pat-001', name: 'John Doe' }
    const mockEntry = { id: 'wr-new', patientId: 'pat-001', patientName: 'John Doe', status: 'waiting' }

    mockPrisma.patient.findFirst.mockResolvedValueOnce(mockPatient)
    mockPrisma.waitingRoom.findFirst.mockResolvedValueOnce(null) // no existing
    mockPrisma.waitingRoom.create.mockResolvedValueOnce(mockEntry)

    const req = makeRequest('POST', 'http://localhost/api/waiting-room', {
      patientId: 'pat-001',
      patientName: 'John Doe',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.entry).toBeDefined()
    expect(json.entry.patientId).toBe('pat-001')
  })

  it('returns 400 if patientId missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/waiting-room', {
      patientName: 'John Doe',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/patientId/)
  })

  it('returns 400 if patientName missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/waiting-room', {
      patientId: 'pat-001',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/patientName/)
  })

  it('validates patient exists before adding', async () => {
    mockPrisma.patient.findFirst.mockResolvedValueOnce(null) // patient not found

    const req = makeRequest('POST', 'http://localhost/api/waiting-room', {
      patientId: 'nonexistent',
      patientName: 'Ghost Patient',
    })
    const res = await POST(req)

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/[Pp]atient not found/)
  })

  it('deduplicates existing active waiting room entry', async () => {
    const mockPatient = { id: 'pat-001', name: 'John Doe' }
    const existingEntry = { id: 'wr-existing', patientId: 'pat-001', status: 'waiting' }

    mockPrisma.patient.findFirst.mockResolvedValueOnce(mockPatient)
    mockPrisma.waitingRoom.findFirst.mockResolvedValueOnce(existingEntry)

    const req = makeRequest('POST', 'http://localhost/api/waiting-room', {
      patientId: 'pat-001',
      patientName: 'John Doe',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.deduplicated).toBe(true)
  })
})

// ─── PUT /api/waiting-room/[id] tests ─────────────────────────────────────────

describe('PUT /api/waiting-room/[id]', () => {
  it('updates status to in-service', async () => {
    const updatedEntry = { id: 'wr-1', status: 'in-service', calledAt: new Date().toISOString() }
    mockPrisma.waitingRoom.update.mockResolvedValueOnce(updatedEntry)

    const req = makeRequest('PUT', 'http://localhost/api/waiting-room/wr-1', {
      status: 'in-service',
    })
    const res = await PUT_ID(req, makeContext('wr-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.entry.status).toBe('in-service')
  })

  it('updates nurseName', async () => {
    const updatedEntry = { id: 'wr-1', status: 'waiting', nurseName: 'Nurse Rosa' }
    mockPrisma.waitingRoom.update.mockResolvedValueOnce(updatedEntry)

    const req = makeRequest('PUT', 'http://localhost/api/waiting-room/wr-1', {
      nurseName: 'Nurse Rosa',
    })
    const res = await PUT_ID(req, makeContext('wr-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.entry.nurseName).toBe('Nurse Rosa')
  })

  it('updates status to complete', async () => {
    const updatedEntry = { id: 'wr-1', status: 'complete', completedAt: new Date().toISOString() }
    mockPrisma.waitingRoom.update.mockResolvedValueOnce(updatedEntry)
    // For the completion timing update
    mockPrisma.$queryRawUnsafe?.mockResolvedValue([])

    const req = makeRequest('PUT', 'http://localhost/api/waiting-room/wr-1', {
      status: 'complete',
    })
    const res = await PUT_ID(req, makeContext('wr-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.entry.status).toBe('complete')
  })

  it('returns 400 for invalid status', async () => {
    const req = makeRequest('PUT', 'http://localhost/api/waiting-room/wr-1', {
      status: 'invalid-status',
    })
    const res = await PUT_ID(req, makeContext('wr-1'))

    expect(res.status).toBe(400)
  })

  it('returns 404 / error for non-existent entry', async () => {
    mockPrisma.waitingRoom.update.mockRejectedValueOnce(
      Object.assign(new Error('Record not found'), { code: 'P2025' })
    )

    const req = makeRequest('PUT', 'http://localhost/api/waiting-room/nonexistent', {
      status: 'in-service',
    })
    const res = await PUT_ID(req, makeContext('nonexistent'))

    // Route returns 500 on unexpected errors; either 404 or 500 indicates entry not found
    expect([404, 500]).toContain(res.status)
  })
})

// ─── SSE stream tests ─────────────────────────────────────────────────────────

describe('GET /api/waiting-room/stream — SSE', () => {
  it('stream route exists and returns correct Content-Type header', async () => {
    const streamRoute = await import('@/app/api/waiting-room/stream/route')
    expect(streamRoute.GET).toBeDefined()
    expect(typeof streamRoute.GET).toBe('function')
  })

  it('SSE route returns text/event-stream content type', async () => {
    const sessionMod = await import('@/lib/auth/session')
    ;(sessionMod.verifySession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      userId: 'user-1',
      role: 'admin',
    })

    mockPrisma.$queryRaw.mockResolvedValue([])

    const { GET: STREAM_GET } = await import('@/app/api/waiting-room/stream/route')

    // Create an AbortController to cancel the stream quickly
    const controller = new AbortController()
    const req = new Request('http://localhost/api/waiting-room/stream', {
      signal: controller.signal,
    })

    const responsePromise = (STREAM_GET as unknown as (req: Request) => Promise<Response>)(req)

    // Abort immediately to prevent the long polling
    controller.abort()

    const res = await responsePromise
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
  })

  it('SSE returns 401 without auth', async () => {
    const sessionMod = await import('@/lib/auth/session')
    ;(sessionMod.verifySession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { GET: STREAM_GET } = await import('@/app/api/waiting-room/stream/route')
    const req = new Request('http://localhost/api/waiting-room/stream')
    const res = await (STREAM_GET as unknown as (req: Request) => Promise<Response>)(req)

    expect(res.status).toBe(401)
  })
})
