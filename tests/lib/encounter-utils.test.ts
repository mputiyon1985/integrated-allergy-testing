/**
 * @file tests/lib/encounter-utils.test.ts
 * @description Tests for encounter-related utility functions.
 * Since there is no dedicated encounter-utils module yet, this file tests
 * the utility logic extracted directly from the route files.
 */
import { describe, it, expect } from 'vitest'

// ─── Utility: encounter status transitions ────────────────────────────────────

const VALID_ENCOUNTER_STATUSES = ['open', 'complete', 'cancelled', 'billed'] as const
type EncounterStatus = typeof VALID_ENCOUNTER_STATUSES[number]

function isValidEncounterStatus(status: string): status is EncounterStatus {
  return VALID_ENCOUNTER_STATUSES.includes(status as EncounterStatus)
}

function canTransitionStatus(from: EncounterStatus, to: EncounterStatus): boolean {
  const transitions: Record<EncounterStatus, EncounterStatus[]> = {
    open: ['complete', 'cancelled'],
    complete: ['billed'],
    cancelled: [],
    billed: [],
  }
  return transitions[from].includes(to)
}

describe('Encounter status validation', () => {
  it('recognises valid statuses', () => {
    expect(isValidEncounterStatus('open')).toBe(true)
    expect(isValidEncounterStatus('complete')).toBe(true)
    expect(isValidEncounterStatus('cancelled')).toBe(true)
    expect(isValidEncounterStatus('billed')).toBe(true)
  })

  it('rejects invalid statuses', () => {
    expect(isValidEncounterStatus('hacked')).toBe(false)
    expect(isValidEncounterStatus('')).toBe(false)
    expect(isValidEncounterStatus('OPEN')).toBe(false) // case-sensitive
  })

  it('allows open → complete transition', () => {
    expect(canTransitionStatus('open', 'complete')).toBe(true)
  })

  it('allows open → cancelled transition', () => {
    expect(canTransitionStatus('open', 'cancelled')).toBe(true)
  })

  it('allows complete → billed transition', () => {
    expect(canTransitionStatus('complete', 'billed')).toBe(true)
  })

  it('rejects backwards transitions', () => {
    expect(canTransitionStatus('complete', 'open')).toBe(false)
    expect(canTransitionStatus('cancelled', 'open')).toBe(false)
    expect(canTransitionStatus('billed', 'complete')).toBe(false)
  })
})

// ─── Utility: timing calculations ────────────────────────────────────────────

function calcWaitMinutes(checkedInAt: Date, calledAt: Date): number {
  return Math.max(0, Math.round((calledAt.getTime() - checkedInAt.getTime()) / 60000))
}

function calcInServiceMinutes(calledAt: Date, completedAt: Date): number {
  return Math.max(0, Math.round((completedAt.getTime() - calledAt.getTime()) / 60000))
}

describe('Encounter timing calculations', () => {
  it('calculates wait time in minutes', () => {
    const checkedInAt = new Date('2024-06-01T09:00:00Z')
    const calledAt = new Date('2024-06-01T09:20:00Z')
    expect(calcWaitMinutes(checkedInAt, calledAt)).toBe(20)
  })

  it('calculates in-service time in minutes', () => {
    const calledAt = new Date('2024-06-01T09:20:00Z')
    const completedAt = new Date('2024-06-01T09:50:00Z')
    expect(calcInServiceMinutes(calledAt, completedAt)).toBe(30)
  })

  it('returns 0 for negative wait time (clock skew)', () => {
    const calledAt = new Date('2024-06-01T09:00:00Z')
    const checkedInAt = new Date('2024-06-01T09:05:00Z') // called before check-in?
    expect(calcWaitMinutes(checkedInAt, calledAt)).toBe(0)
  })

  it('handles exact same timestamps', () => {
    const t = new Date('2024-06-01T09:00:00Z')
    expect(calcWaitMinutes(t, t)).toBe(0)
    expect(calcInServiceMinutes(t, t)).toBe(0)
  })
})

// ─── Utility: encounter date defaults ────────────────────────────────────────

function resolveEncounterDate(input: unknown): string {
  if (input && typeof input === 'string') return input
  return new Date().toISOString()
}

describe('Encounter date resolution', () => {
  it('uses provided date string', () => {
    const date = '2024-06-15T10:00:00Z'
    expect(resolveEncounterDate(date)).toBe(date)
  })

  it('defaults to now when no date provided', () => {
    const before = Date.now()
    const result = new Date(resolveEncounterDate(undefined)).getTime()
    const after = Date.now()
    expect(result).toBeGreaterThanOrEqual(before)
    expect(result).toBeLessThanOrEqual(after)
  })

  it('defaults to now when null provided', () => {
    const result = resolveEncounterDate(null)
    expect(result).toBeTruthy()
    expect(() => new Date(result)).not.toThrow()
  })
})

// ─── Utility: activityType normalisation ─────────────────────────────────────

function resolveActivityType(body: Record<string, unknown>): string | undefined {
  const val = body.activityType ?? body.type
  return val ? String(val) : undefined
}

describe('Activity type resolution', () => {
  it('uses activityType (frontend field) when present', () => {
    expect(resolveActivityType({ activityType: 'nurse_note' })).toBe('nurse_note')
  })

  it('falls back to type (DB column) when activityType absent', () => {
    expect(resolveActivityType({ type: 'injection' })).toBe('injection')
  })

  it('prefers activityType over type when both present', () => {
    expect(resolveActivityType({ activityType: 'soap_note', type: 'old_value' })).toBe('soap_note')
  })

  it('returns undefined when neither present', () => {
    expect(resolveActivityType({ patientId: 'pat-1' })).toBeUndefined()
  })
})

// ─── Utility: SQL filter builder (mirrors GET /api/encounters logic) ──────────

interface EncounterFilters {
  patientId?: string
  locationId?: string
  status?: string
  from?: string
  to?: string
}

function buildEncounterWhereClauses(filters: EncounterFilters): { clauses: string[]; values: unknown[] } {
  const clauses: string[] = []
  const values: unknown[] = []

  if (filters.patientId) { clauses.push('e.patientId=?'); values.push(filters.patientId) }
  if (filters.locationId) { clauses.push('e.locationId=?'); values.push(filters.locationId) }
  if (filters.status) { clauses.push('e.status=?'); values.push(filters.status) }
  if (filters.from) { clauses.push('date(e.encounterDate) >= ?'); values.push(filters.from) }
  if (filters.to) { clauses.push('date(e.encounterDate) <= ?'); values.push(filters.to) }

  return { clauses, values }
}

describe('Encounter SQL filter builder', () => {
  it('returns no clauses for empty filters', () => {
    const { clauses, values } = buildEncounterWhereClauses({})
    expect(clauses).toHaveLength(0)
    expect(values).toHaveLength(0)
  })

  it('builds patientId filter', () => {
    const { clauses, values } = buildEncounterWhereClauses({ patientId: 'pat-1' })
    expect(clauses).toContain('e.patientId=?')
    expect(values).toContain('pat-1')
  })

  it('builds locationId filter', () => {
    const { clauses, values } = buildEncounterWhereClauses({ locationId: 'loc-5' })
    expect(clauses).toContain('e.locationId=?')
    expect(values).toContain('loc-5')
  })

  it('builds status filter', () => {
    const { clauses, values } = buildEncounterWhereClauses({ status: 'open' })
    expect(clauses).toContain('e.status=?')
    expect(values).toContain('open')
  })

  it('builds date range filter', () => {
    const { clauses, values } = buildEncounterWhereClauses({ from: '2024-01-01', to: '2024-12-31' })
    expect(clauses.some(c => c.includes('>= ?'))).toBe(true)
    expect(clauses.some(c => c.includes('<= ?'))).toBe(true)
    expect(values).toContain('2024-01-01')
    expect(values).toContain('2024-12-31')
  })

  it('combines multiple filters', () => {
    const { clauses, values } = buildEncounterWhereClauses({
      patientId: 'pat-2',
      status: 'complete',
      from: '2024-06-01',
    })
    expect(clauses).toHaveLength(3)
    expect(values).toHaveLength(3)
  })
})
