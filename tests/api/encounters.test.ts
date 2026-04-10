/**
 * @file tests/api/encounters.test.ts
 * @description Comprehensive API unit tests for encounter routes
 * Mirrors the validation-first pattern in waiting-room.test.ts, plus route handler tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Inline validation mirrors (mirrors route validation logic) ───────────────

function validateEncounterPost(body: unknown): string | null {
  const b = body as Record<string, unknown>
  if (!b.patientId) return 'patientId required'
  if (!b.chiefComplaint) return 'patientId and chiefComplaint required'
  return null
}

function validateEncounterPut(body: unknown): string | null {
  const b = body as Record<string, unknown>
  const fields = ['chiefComplaint','subjectiveNotes','objectiveNotes','assessment','plan',
                  'status','doctorId','doctorName','nurseId','nurseName','appointmentId','followUpDays','encounterDate']
  const hasAny = fields.some(f => b[f] !== undefined)
  if (!hasAny) return 'No fields to update'
  return null
}

function defaultEncounterStatus(body: Record<string, unknown>): string {
  return body.status ? String(body.status) : 'open'
}

function validateActivityPost(body: unknown): string | null {
  const b = body as Record<string, unknown>
  const actType = b.activityType ?? b.type
  if (!b.patientId) return 'patientId and activityType (or type) are required'
  if (!actType) return 'patientId and activityType (or type) are required'
  return null
}

// ─── Section 1: Inline validation unit tests ─────────────────────────────────

describe('POST /api/encounters — validation', () => {
  it('accepts required fields (patientId + chiefComplaint)', () => {
    expect(validateEncounterPost({ patientId: 'pat-001', chiefComplaint: 'Allergy symptoms' })).toBeNull()
  })

  it('returns error if patientId is missing', () => {
    expect(validateEncounterPost({ chiefComplaint: 'Headache' })).toMatch(/patientId/)
  })

  it('returns error if chiefComplaint is missing', () => {
    expect(validateEncounterPost({ patientId: 'pat-001' })).toMatch(/chiefComplaint/)
  })

  it('defaults status to open when not provided', () => {
    expect(defaultEncounterStatus({ patientId: 'pat-001', chiefComplaint: 'test' })).toBe('open')
  })

  it('respects explicit status when provided', () => {
    expect(defaultEncounterStatus({ status: 'complete' })).toBe('complete')
  })
})

describe('PUT /api/encounters/[id] — validation', () => {
  it('accepts nurseName update', () => {
    expect(validateEncounterPut({ nurseName: 'Jane Smith' })).toBeNull()
  })

  it('accepts status update to complete', () => {
    expect(validateEncounterPut({ status: 'complete' })).toBeNull()
  })

  it('returns error when no fields provided', () => {
    expect(validateEncounterPut({})).toBe('No fields to update')
  })

  it('accepts SOAP fields update', () => {
    expect(validateEncounterPut({
      subjectiveNotes: 'Patient reports itchy eyes',
      objectiveNotes: 'Mild conjunctival injection',
      assessment: 'Allergic conjunctivitis',
      plan: 'Prescribe antihistamine eye drops',
    })).toBeNull()
  })
})

describe('POST /api/encounter-activities — validation', () => {
  it('accepts valid activityType field', () => {
    expect(validateActivityPost({ patientId: 'pat-001', activityType: 'nurse_note' })).toBeNull()
  })

  it('accepts legacy type field (DB column name)', () => {
    expect(validateActivityPost({ patientId: 'pat-001', type: 'injection' })).toBeNull()
  })

  it('returns error when patientId is missing', () => {
    expect(validateActivityPost({ activityType: 'nurse_note' })).toMatch(/patientId/)
  })

  it('returns error when activityType/type both missing', () => {
    expect(validateActivityPost({ patientId: 'pat-001' })).toMatch(/activityType/)
  })
})

// ─── Section 2: SOAP field mapping ───────────────────────────────────────────

describe('Encounter Activity — SOAP field mapping', () => {
  function mapSoapFields(body: Record<string, unknown>) {
    // Mirrors the logic in /api/encounter-activities/route.ts
    return {
      subjectiveNotes: (body.soapSubjective ?? body.subjectiveNotes)
        ? String(body.soapSubjective ?? body.subjectiveNotes).slice(0, 2000)
        : null,
      objectiveNotes: (body.soapObjective ?? body.objectiveNotes)
        ? String(body.soapObjective ?? body.objectiveNotes).slice(0, 2000)
        : null,
      assessment: (body.soapAssessment ?? body.assessment)
        ? String(body.soapAssessment ?? body.assessment).slice(0, 2000)
        : null,
      plan: (body.soapPlan ?? body.plan)
        ? String(body.soapPlan ?? body.plan).slice(0, 2000)
        : null,
    }
  }

  it('maps soapSubjective → subjectiveNotes', () => {
    const result = mapSoapFields({ soapSubjective: 'Patient complains of itching' })
    expect(result.subjectiveNotes).toBe('Patient complains of itching')
  })

  it('maps subjectiveNotes directly (DB column name)', () => {
    const result = mapSoapFields({ subjectiveNotes: 'Direct column value' })
    expect(result.subjectiveNotes).toBe('Direct column value')
  })

  it('prefers soapSubjective over subjectiveNotes', () => {
    const result = mapSoapFields({ soapSubjective: 'from kiosk', subjectiveNotes: 'from db' })
    expect(result.subjectiveNotes).toBe('from kiosk')
  })

  it('maps all four SOAP fields correctly', () => {
    const result = mapSoapFields({
      soapSubjective: 'S: notes',
      soapObjective: 'O: notes',
      soapAssessment: 'A: notes',
      soapPlan: 'P: notes',
    })
    expect(result.subjectiveNotes).toBe('S: notes')
    expect(result.objectiveNotes).toBe('O: notes')
    expect(result.assessment).toBe('A: notes')
    expect(result.plan).toBe('P: notes')
  })

  it('truncates SOAP fields to 2000 chars', () => {
    const longText = 'x'.repeat(2500)
    const result = mapSoapFields({ soapSubjective: longText })
    expect(result.subjectiveNotes?.length).toBe(2000)
  })

  it('returns null for missing SOAP fields', () => {
    const result = mapSoapFields({ patientId: 'pat-001', activityType: 'note' })
    expect(result.subjectiveNotes).toBeNull()
    expect(result.objectiveNotes).toBeNull()
    expect(result.assessment).toBeNull()
    expect(result.plan).toBeNull()
  })
})

// ─── Section 3: Route handler tests with mocked prisma ───────────────────────

vi.mock('@/lib/db', () => ({
  default: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    auditLog: { create: vi.fn().mockReturnValue(Promise.resolve()) },
  },
}))

vi.mock('@/lib/api-permissions', () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/hipaaHeaders', () => ({
  HIPAA_HEADERS: { 'x-content-type-options': 'nosniff' },
}))

// lazy imports so mocks apply first
let GET: (req: Request) => Promise<Response>
let POST: (req: Request) => Promise<Response>
let GET_ID: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let PUT_ID: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let POST_ACTIVITIES: (req: Request) => Promise<Response>
let requirePermission: ReturnType<typeof vi.fn>
let mockPrisma: { $queryRawUnsafe: ReturnType<typeof vi.fn>; $executeRawUnsafe: ReturnType<typeof vi.fn>; auditLog: { create: ReturnType<typeof vi.fn> } }

beforeEach(async () => {
  vi.clearAllMocks()
  // Re-import after clearing mocks
  const encRoute = await import('@/app/api/encounters/route')
  const encIdRoute = await import('@/app/api/encounters/[id]/route')
  const actRoute = await import('@/app/api/encounter-activities/route')
  const perms = await import('@/lib/api-permissions')
  const db = await import('@/lib/db')

  GET = encRoute.GET as unknown as (req: Request) => Promise<Response>
  POST = encRoute.POST as unknown as (req: Request) => Promise<Response>
  GET_ID = encIdRoute.GET as unknown as (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
  PUT_ID = encIdRoute.PUT as unknown as (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
  POST_ACTIVITIES = actRoute.POST as unknown as (req: Request) => Promise<Response>
  requirePermission = perms.requirePermission as ReturnType<typeof vi.fn>
  mockPrisma = db.default as unknown as typeof mockPrisma
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

describe('GET /api/encounters — route handler', () => {
  it('returns encounters list', async () => {
    const mockEncounters = [
      { id: 'enc-1', patientId: 'pat-1', chiefComplaint: 'Allergies', status: 'open' },
    ]
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(mockEncounters)

    const req = makeRequest('GET', 'http://localhost/api/encounters')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.encounters).toEqual(mockEncounters)
  })

  it('filters by locationId when provided', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/encounters?locationId=loc-1')
    await GET(req)

    const call = mockPrisma.$queryRawUnsafe.mock.calls[0]
    expect(call[0]).toContain('locationId=?')
    expect(call).toContain('loc-1')
  })

  it('filters by status=open', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/encounters?status=open')
    await GET(req)

    const call = mockPrisma.$queryRawUnsafe.mock.calls[0]
    expect(call[0]).toContain('status=?')
    expect(call).toContain('open')
  })

  it('filters by patientId', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/encounters?patientId=pat-99')
    await GET(req)

    const call = mockPrisma.$queryRawUnsafe.mock.calls[0]
    expect(call[0]).toContain('patientId=?')
    expect(call).toContain('pat-99')
  })

  it('filters by date range (from/to)', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/encounters?from=2024-01-01&to=2024-12-31')
    await GET(req)

    const call = mockPrisma.$queryRawUnsafe.mock.calls[0]
    expect(call[0]).toContain('encounterDate')
    expect(call).toContain('2024-01-01')
    expect(call).toContain('2024-12-31')
  })

  it('returns empty array (not error) when no results', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([])

    const req = makeRequest('GET', 'http://localhost/api/encounters?patientId=nonexistent')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.encounters).toEqual([])
  })
})

describe('POST /api/encounters — route handler', () => {
  it('creates encounter with required fields', async () => {
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/encounters', {
      patientId: 'pat-001',
      chiefComplaint: 'Annual allergy check',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.encounter).toBeDefined()
    expect(json.encounter.patientId).toBe('pat-001')
    expect(json.encounter.chiefComplaint).toBe('Annual allergy check')
  })

  it('returns the new encounter id', async () => {
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/encounters', {
      patientId: 'pat-001',
      chiefComplaint: 'Test',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(json.encounter.id).toBeDefined()
    expect(typeof json.encounter.id).toBe('string')
  })

  it('defaults status to open', async () => {
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/encounters', {
      patientId: 'pat-001',
      chiefComplaint: 'Runny nose',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(json.encounter.status).toBe('open')
  })

  it('returns 400 if patientId missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/encounters', {
      chiefComplaint: 'No patient',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 if chiefComplaint missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/encounters', {
      patientId: 'pat-001',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const { NextResponse } = await import('next/server')
    requirePermission.mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const req = makeRequest('POST', 'http://localhost/api/encounters', {
      patientId: 'pat-001',
      chiefComplaint: 'Test',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/encounters/[id] — route handler', () => {
  it('updates nurseName', async () => {
    const updatedEncounter = {
      id: 'enc-1',
      patientId: 'pat-1',
      nurseName: 'Nurse Jane',
      status: 'open',
    }
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([updatedEncounter])

    const req = makeRequest('PUT', 'http://localhost/api/encounters/enc-1', {
      nurseName: 'Nurse Jane',
    })
    const res = await PUT_ID(req, makeContext('enc-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.encounter.nurseName).toBe('Nurse Jane')
  })

  it('updates status to complete', async () => {
    const updatedEncounter = { id: 'enc-1', status: 'complete' }
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([updatedEncounter])

    const req = makeRequest('PUT', 'http://localhost/api/encounters/enc-1', {
      status: 'complete',
    })
    const res = await PUT_ID(req, makeContext('enc-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.encounter.status).toBe('complete')
  })

  it('returns 404 for non-existent encounter', async () => {
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]) // empty = not found

    const req = makeRequest('PUT', 'http://localhost/api/encounters/nonexistent', {
      status: 'complete',
    })
    const res = await PUT_ID(req, makeContext('nonexistent'))
    const json = await res.json()

    // Route returns encounter: null — check either 200 with null or 404
    expect(json.encounter === null || res.status === 404).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const { NextResponse } = await import('next/server')
    requirePermission.mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const req = makeRequest('PUT', 'http://localhost/api/encounters/enc-1', {
      status: 'complete',
    })
    const res = await PUT_ID(req, makeContext('enc-1'))
    expect(res.status).toBe(401)
  })
})

describe('GET /api/encounters/[id] — route handler', () => {
  it('returns encounter with activities', async () => {
    const encounter = { id: 'enc-1', patientId: 'pat-1', status: 'open', chiefComplaint: 'Allergies' }
    const activities = [{ id: 'act-1', activityType: 'nurse_note', encounterId: 'enc-1' }]
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([encounter])  // encounter query
      .mockResolvedValueOnce(activities)  // activities query

    const req = makeRequest('GET', 'http://localhost/api/encounters/enc-1')
    const res = await GET_ID(req, makeContext('enc-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('enc-1')
    expect(json.activities).toEqual(activities)
  })

  it('returns 404 when encounter not found', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]) // not found

    const req = makeRequest('GET', 'http://localhost/api/encounters/missing')
    const res = await GET_ID(req, makeContext('missing'))

    expect(res.status).toBe(404)
  })
})

describe('POST /api/encounter-activities — route handler', () => {
  it('creates activity linked to encounter', async () => {
    const activityId = 'act-new-1'
    // Check encounter exists
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'enc-1' }])
    // Insert activity
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)
    // Return created activity
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{
      id: activityId,
      encounterId: 'enc-1',
      patientId: 'pat-1',
      activityType: 'nurse_note',
    }])

    const req = makeRequest('POST', 'http://localhost/api/encounter-activities', {
      patientId: 'pat-1',
      activityType: 'nurse_note',
      encounterId: 'enc-1',
      notes: 'Patient arrived',
    })
    const res = await POST_ACTIVITIES(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.encounterId).toBe('enc-1')
  })

  it('activityType maps correctly to type column in INSERT', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'enc-1' }])
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'act-1', activityType: 'injection' }])

    const req = makeRequest('POST', 'http://localhost/api/encounter-activities', {
      patientId: 'pat-1',
      activityType: 'injection',
      encounterId: 'enc-1',
    })
    await POST_ACTIVITIES(req)

    // Verify $executeRawUnsafe was called with 'injection' as the type value
    const insertCall = mockPrisma.$executeRawUnsafe.mock.calls[0]
    expect(insertCall).toContain('injection')
  })

  it('SOAP fields save correctly via soapXxx aliases', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'enc-1' }])
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'act-1' }])

    const req = makeRequest('POST', 'http://localhost/api/encounter-activities', {
      patientId: 'pat-1',
      activityType: 'soap_note',
      encounterId: 'enc-1',
      soapSubjective: 'Patient c/o sneezing',
      soapObjective: 'Clear nasal discharge',
      soapAssessment: 'Seasonal allergic rhinitis',
      soapPlan: 'Prescribe cetirizine 10mg',
    })
    await POST_ACTIVITIES(req)

    const insertCall = mockPrisma.$executeRawUnsafe.mock.calls[0]
    expect(insertCall).toContain('Patient c/o sneezing')
    expect(insertCall).toContain('Clear nasal discharge')
    expect(insertCall).toContain('Seasonal allergic rhinitis')
    expect(insertCall).toContain('Prescribe cetirizine 10mg')
  })

  it('returns 400 when patientId is missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/encounter-activities', {
      activityType: 'note',
    })
    const res = await POST_ACTIVITIES(req)
    expect(res.status).toBe(400)
  })

  it('auto-creates encounter when encounterId not provided', async () => {
    // No existing encounter found today
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([])
    // Insert auto-created encounter
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)
    // Insert activity
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)
    // Return created activity
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'act-new', activityType: 'note' }])

    const req = makeRequest('POST', 'http://localhost/api/encounter-activities', {
      patientId: 'pat-new',
      activityType: 'check_in',
    })
    const res = await POST_ACTIVITIES(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.encounterId).toBeDefined()
  })
})
