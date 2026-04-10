/**
 * @file tests/api/encounter-lifecycle.test.ts
 * @description Tests the complete check-in → encounter → complete lifecycle.
 * Uses inline logic tests (no HTTP calls needed) to verify the integration contracts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  default: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    waitingRoom: {
      update: vi.fn(),
    },
    auditLog: { create: vi.fn().mockReturnValue(Promise.resolve()) },
  },
}))

vi.mock('@/lib/api-permissions', () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/hipaaHeaders', () => ({
  HIPAA_HEADERS: { 'x-content-type-options': 'nosniff' },
}))

let mockPrisma: {
  $queryRawUnsafe: ReturnType<typeof vi.fn>
  $executeRawUnsafe: ReturnType<typeof vi.fn>
  waitingRoom: { update: ReturnType<typeof vi.fn> }
  auditLog: { create: ReturnType<typeof vi.fn> }
}

beforeEach(async () => {
  vi.clearAllMocks()
  const db = await import('@/lib/db')
  mockPrisma = db.default as unknown as typeof mockPrisma
})

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}

// ─── Lifecycle contract helpers (mirrors actual route behavior) ───────────────

/**
 * Simulates what POST /api/encounters does when a patient checks in.
 * Returns the encounter id that would be created.
 */
async function simulateCreateEncounter(patientId: string, chiefComplaint: string): Promise<{ id: string; status: string }> {
  mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)
  const { POST } = await import('@/app/api/encounters/route')
  const req = makeRequest('POST', 'http://localhost/api/encounters', { patientId, chiefComplaint })
  const res = await (POST as unknown as (req: Request) => Promise<Response>)(req)
  const json = await res.json()
  return json.encounter
}

/**
 * Simulates POST /api/encounter-activities (e.g. nurse logs "brought to exam room").
 */
async function simulateCreateActivity(
  patientId: string,
  encounterId: string,
  activityType: string,
  notes?: string
): Promise<{ ok: boolean; encounterId: string }> {
  mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: encounterId }])
  mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)
  mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{
    id: 'act-1',
    encounterId,
    activityType,
    notes: notes ?? null,
  }])
  const { POST } = await import('@/app/api/encounter-activities/route')
  const req = makeRequest('POST', 'http://localhost/api/encounter-activities', {
    patientId,
    activityType,
    encounterId,
    notes,
  })
  const res = await (POST as unknown as (req: Request) => Promise<Response>)(req)
  return res.json()
}

/**
 * Simulates PUT /api/encounters/[id] to close the encounter.
 */
async function simulateCloseEncounter(encounterId: string): Promise<{ encounter: Record<string, unknown> }> {
  mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)
  mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{
    id: encounterId,
    status: 'complete',
  }])
  const { PUT } = await import('@/app/api/encounters/[id]/route')
  const req = makeRequest('PUT', `http://localhost/api/encounters/${encounterId}`, {
    status: 'complete',
  })
  const res = await (PUT as unknown as (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>)(
    req,
    { params: Promise.resolve({ id: encounterId }) }
  )
  return res.json()
}

// ─── Lifecycle Tests ──────────────────────────────────────────────────────────

describe('Encounter Lifecycle', () => {
  it('auto-creates encounter on patient check-in', async () => {
    const encounter = await simulateCreateEncounter('pat-lifecycle-1', 'Annual allergy injection')

    expect(encounter).toBeDefined()
    expect(encounter.id).toBeTruthy()
    expect(encounter.patientId).toBe('pat-lifecycle-1')
    expect(encounter.chiefComplaint).toBe('Annual allergy injection')
    expect(encounter.status).toBe('open')

    // Verify INSERT was called with correct patientId, chiefComplaint and status
    const insertCall = mockPrisma.$executeRawUnsafe.mock.calls[0]
    expect(typeof insertCall[0]).toBe('string')
    expect(insertCall[0]).toContain('INSERT INTO Encounter')
    // args are spread: [sql, id, patientId, chiefComplaint, ..., status, ...]
    expect(insertCall).toContain('pat-lifecycle-1')
    expect(insertCall).toContain('Annual allergy injection')
    expect(insertCall).toContain('open')
  })

  it('logs nurse activity when patient called back', async () => {
    const encounterId = 'enc-lifecycle-1'
    const result = await simulateCreateActivity(
      'pat-lifecycle-1',
      encounterId,
      'patient_called_back',
      'Patient brought to exam room'
    )

    expect(result.ok).toBe(true)
    expect(result.encounterId).toBe(encounterId)

    // Verify activity was inserted with correct type
    const insertCall = mockPrisma.$executeRawUnsafe.mock.calls.find((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO EncounterActivity')
    )
    expect(insertCall).toBeDefined()
    expect(insertCall).toContain('patient_called_back')
    expect(insertCall).toContain('Patient brought to exam room')
  })

  it('closes encounter when waiting room marked complete', async () => {
    const encounterId = 'enc-lifecycle-2'
    const result = await simulateCloseEncounter(encounterId)

    expect(result.encounter).toBeDefined()
    expect(result.encounter.status).toBe('complete')

    // Verify UPDATE was called with status=complete
    const updateCall = mockPrisma.$executeRawUnsafe.mock.calls.find((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('UPDATE Encounter SET')
    )
    expect(updateCall).toBeDefined()
    expect(updateCall).toContain('complete')
    expect(updateCall[updateCall.length - 1]).toBe(encounterId)
  })

  it('full lifecycle: check-in → nurse activity → complete', async () => {
    // Step 1: Patient checks in → encounter created
    const encounter = await simulateCreateEncounter('pat-full-1', 'Allergy shot visit')
    expect(encounter.status).toBe('open')

    const encounterId = encounter.id

    // Step 2: Nurse calls patient back → activity logged
    const activityResult = await simulateCreateActivity(
      'pat-full-1',
      encounterId,
      'nurse_called_back',
      'Patient brought to exam room 3'
    )
    expect(activityResult.ok).toBe(true)

    // Step 3: Encounter closed
    const closeResult = await simulateCloseEncounter(encounterId)
    expect(closeResult.encounter.status).toBe('complete')
  })
})

// ─── Waiting-room → encounter status sync ─────────────────────────────────────

describe('Waiting room status sync to encounter', () => {
  /**
   * Validates that PUT /api/waiting-room/[id] with status=complete
   * correctly queries and updates the linked encounter.
   */
  it('when waiting room entry completed, encounter receives timing data', async () => {
    const wrId = 'wr-001'
    const patientId = 'pat-timing-1'
    const encounterId = 'enc-timing-1'

    // Mock waitingRoom.update (Prisma ORM call)
    mockPrisma.waitingRoom.update.mockResolvedValueOnce({
      id: wrId,
      status: 'complete',
      patientId,
    })

    // Mock: fetching WaitingRoom timing data
    const now = new Date()
    const checkedInAt = new Date(now.getTime() - 30 * 60000) // 30 min ago
    const calledAt = new Date(now.getTime() - 10 * 60000)    // 10 min ago
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ patientId, checkedInAt: checkedInAt.toISOString(), calledAt: calledAt.toISOString() }])
      .mockResolvedValueOnce([{ id: encounterId }])  // find open encounter

    // Mock: update encounter with timing
    mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(undefined)

    const { PUT } = await import('@/app/api/waiting-room/[id]/route')
    const req = makeRequest('PUT', `http://localhost/api/waiting-room/${wrId}`, { status: 'complete' })
    const res = await (PUT as unknown as (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>)(
      req,
      { params: Promise.resolve({ id: wrId }) }
    )

    expect(res.status).toBe(200)

    // Verify Prisma update was called to mark entry complete
    expect(mockPrisma.waitingRoom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: wrId },
        data: expect.objectContaining({ status: 'complete' }),
      })
    )

    // Verify encounter timing update was attempted
    const encounterUpdate = mockPrisma.$executeRawUnsafe.mock.calls.find((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('UPDATE Encounter SET waitMinutes')
    )
    expect(encounterUpdate).toBeDefined()
  })

  it('calling back patient (status=in-service) sets calledAt timestamp', async () => {
    const wrId = 'wr-002'
    mockPrisma.waitingRoom.update.mockResolvedValueOnce({
      id: wrId,
      status: 'in-service',
    })

    const { PUT } = await import('@/app/api/waiting-room/[id]/route')
    const req = makeRequest('PUT', `http://localhost/api/waiting-room/${wrId}`, {
      status: 'in-service',
      nurseName: 'Nurse Rodriguez',
    })
    const res = await (PUT as unknown as (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>)(
      req,
      { params: Promise.resolve({ id: wrId }) }
    )

    expect(res.status).toBe(200)

    // The update should include calledAt
    expect(mockPrisma.waitingRoom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'in-service',
          calledAt: expect.any(Date),
        }),
      })
    )
  })

  it('returns 400 for invalid status value', async () => {
    const wrId = 'wr-003'

    const { PUT } = await import('@/app/api/waiting-room/[id]/route')
    const req = makeRequest('PUT', `http://localhost/api/waiting-room/${wrId}`, {
      status: 'invalid-status',
    })
    const res = await (PUT as unknown as (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>)(
      req,
      { params: Promise.resolve({ id: wrId }) }
    )

    expect(res.status).toBe(400)
  })
})
