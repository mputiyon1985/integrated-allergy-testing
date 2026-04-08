import { describe, it, expect } from 'vitest'

// Mirror the routing logic from verify/page.tsx
function determineNextStep(
  totalVideos: number,
  watchedCount: number,
  allSigned: boolean
): 'done' | 'consent' | 'videos' {
  const allVideosDone = totalVideos === 0 || watchedCount >= totalVideos
  const allConsentDone = allSigned
  if (allVideosDone && allConsentDone) return 'done'
  if (allVideosDone) return 'consent'
  return 'videos'
}

describe('Kiosk routing logic', () => {
  it('routes to done when videos watched and consent signed', () => {
    expect(determineNextStep(2, 2, true)).toBe('done')
  })
  it('routes to consent when videos watched but not signed', () => {
    expect(determineNextStep(2, 2, false)).toBe('consent')
  })
  it('routes to videos when not all watched', () => {
    expect(determineNextStep(2, 1, false)).toBe('videos')
    expect(determineNextStep(2, 0, false)).toBe('videos')
  })
  it('skips videos when none configured', () => {
    expect(determineNextStep(0, 0, false)).toBe('consent')
    expect(determineNextStep(0, 0, true)).toBe('done')
  })
  it('routes to done when all watched even if count exceeds', () => {
    expect(determineNextStep(2, 3, true)).toBe('done')
  })
})
