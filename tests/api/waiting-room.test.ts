import { describe, it, expect } from 'vitest'

// Mirror validation from waiting-room/route.ts
function validateWaitingRoomPost(body: unknown): string | null {
  const b = body as Record<string, unknown>
  if (!b.patientId || typeof b.patientId !== 'string') return 'patientId required'
  if (!b.patientName || typeof b.patientName !== 'string') return 'patientName required'
  if (b.status && !['waiting','in-service','complete','cancelled'].includes(b.status as string)) return 'invalid status'
  if (b.notes && typeof b.notes === 'string' && b.notes.length > 500) return 'notes too long'
  const videosWatched = Number(b.videosWatched ?? 0)
  if (isNaN(videosWatched) || videosWatched < 0) return 'invalid videosWatched'
  return null
}

describe('Waiting room validation', () => {
  it('accepts valid entries', () => {
    expect(validateWaitingRoomPost({ patientId: 'pat-001', patientName: 'John Doe', videosWatched: 2 })).toBeNull()
  })
  it('rejects missing patientId', () => {
    expect(validateWaitingRoomPost({ patientName: 'John' })).toBe('patientId required')
  })
  it('rejects invalid status', () => {
    expect(validateWaitingRoomPost({ patientId: 'x', patientName: 'y', status: 'hacked' })).toBe('invalid status')
  })
  it('rejects notes over 500 chars', () => {
    expect(validateWaitingRoomPost({ patientId: 'x', patientName: 'y', notes: 'a'.repeat(501) })).toBe('notes too long')
  })
  it('rejects negative videosWatched', () => {
    expect(validateWaitingRoomPost({ patientId: 'x', patientName: 'y', videosWatched: -1 })).toBe('invalid videosWatched')
  })
})
