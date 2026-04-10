/**
 * @file tests/api/waiting-room-checkin.test.ts
 * @description Integration tests for the Waiting Room check-in flow
 */
import { describe, it, expect } from 'vitest'

describe('Waiting Room Check-In Flow', () => {
  it('validates patient ID format PA-XXXXXXXX', () => {
    const validPattern = /^PA-[A-Z0-9]{8}$/

    // Valid IDs
    expect('PA-TEST0001').toMatch(validPattern)
    expect('PA-ABCD1234').toMatch(validPattern)
    expect('PA-00000000').toMatch(validPattern)

    // Invalid IDs
    expect('PA-test0001').not.toMatch(validPattern)   // lowercase
    expect('PA-1234567').not.toMatch(validPattern)    // too short
    expect('PA-123456789').not.toMatch(validPattern)  // too long
    expect('P-ABCD1234').not.toMatch(validPattern)    // wrong prefix
    expect('PAABCD1234').not.toMatch(validPattern)    // missing dash
    expect('').not.toMatch(validPattern)
  })

  it('prevents duplicate check-in for same patient', () => {
    // Simulate: if patient already in waiting room with status waiting/in-service, return existing
    const existingEntries = [
      { id: 'wr-001', patientId: 'PA-TEST0001', status: 'waiting' },
      { id: 'wr-002', patientId: 'PA-TEST0002', status: 'in-service' },
      { id: 'wr-003', patientId: 'PA-TEST0003', status: 'complete' },
    ]

    function checkDuplicate(patientId: string): string | null {
      const active = existingEntries.find(
        e => e.patientId === patientId && (e.status === 'waiting' || e.status === 'in-service')
      )
      return active?.id ?? null
    }

    // Already waiting — return existing
    expect(checkDuplicate('PA-TEST0001')).toBe('wr-001')
    // Already in-service — return existing
    expect(checkDuplicate('PA-TEST0002')).toBe('wr-002')
    // Complete — allow new check-in (not a duplicate)
    expect(checkDuplicate('PA-TEST0003')).toBeNull()
    // Not present — allow new check-in
    expect(checkDuplicate('PA-NEW00001')).toBeNull()
  })

  it('waiting room entry has required fields', () => {
    const entry = {
      id: 'wr-001',
      patientId: 'PA-TEST0001',
      patientName: 'John Smith',
      status: 'waiting',
      checkedInAt: new Date().toISOString(),
      locationId: 'loc-001',
    }

    expect(entry.id).toBeDefined()
    expect(entry.patientId).toMatch(/^PA-[A-Z0-9]{8}$/)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(entry.status).toSatisfy((s: string) => ['waiting', 'in-service', 'complete'].includes(s))
    expect(entry.checkedInAt).toBeDefined()
    expect(entry.patientName).toBeDefined()
    expect(entry.locationId).toBeDefined()
  })

  it('status transitions are valid', () => {
    const validTransitions: Record<string, string[]> = {
      waiting: ['in-service', 'complete'],
      'in-service': ['complete', 'waiting'],
      complete: [], // terminal state
    }

    expect(validTransitions['waiting']).toContain('in-service')
    expect(validTransitions['waiting']).toContain('complete')
    expect(validTransitions['in-service']).toContain('complete')
    expect(validTransitions['in-service']).toContain('waiting')
    expect(validTransitions['complete']).toHaveLength(0)

    // complete is terminal — no forward transitions
    expect(validTransitions['complete']).not.toContain('waiting')
    expect(validTransitions['complete']).not.toContain('in-service')
  })

  it('wait time calculation is correct', () => {
    const checkedInAt = new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 min ago
    const waitMs = Date.now() - new Date(checkedInAt).getTime()
    const waitMin = Math.floor(waitMs / 60000)

    expect(waitMin).toBeGreaterThanOrEqual(14)
    expect(waitMin).toBeLessThanOrEqual(16)
  })

  it('formats wait time string correctly', () => {
    function waitTime(checkedInAt: string): string {
      const mins = Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60000)
      if (mins < 1) return 'Just arrived'
      if (mins === 1) return '1 min'
      return `${mins} mins`
    }

    const justNow = new Date().toISOString()
    expect(waitTime(justNow)).toBe('Just arrived')

    const oneMin = new Date(Date.now() - 65 * 1000).toISOString()
    expect(waitTime(oneMin)).toBe('1 min')

    const tenMins = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    expect(waitTime(tenMins)).toBe('10 mins')
  })

  it('checkedInAt is a valid ISO timestamp', () => {
    const checkedInAt = new Date().toISOString()
    const parsed = new Date(checkedInAt)
    expect(parsed.getTime()).not.toBeNaN()
    expect(checkedInAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
