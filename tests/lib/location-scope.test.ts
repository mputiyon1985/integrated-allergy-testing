import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  default: {
    $queryRaw: vi.fn(),
  }
}))

import { getUserLocationScope, buildLocationClause } from '@/lib/location-scope'
import prisma from '@/lib/db'
const mockPrisma = prisma as any

describe('getUserLocationScope', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when user has no allowedLocations (unrestricted)', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ allowedLocations: null }])
    const result = await getUserLocationScope({ id: 'user-1', role: 'admin' })
    expect(result).toBeNull()
  })

  it('returns location IDs when user has restrictions', async () => {
    const locs = ['loc-map-001', 'loc-map-002']
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ allowedLocations: JSON.stringify(locs) }])
    const result = await getUserLocationScope({ id: 'bj-1', role: 'admin' })
    expect(result).toEqual(locs)
  })

  it('returns null when user not found', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([])
    const result = await getUserLocationScope({ id: 'unknown', role: 'staff' })
    expect(result).toBeNull()
  })

  it('returns null on DB error (fail open)', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('DB error'))
    const result = await getUserLocationScope({ id: 'user-1', role: 'admin' })
    expect(result).toBeNull()
  })

  it('returns null for empty array (treated as unrestricted)', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ allowedLocations: '[]' }])
    const result = await getUserLocationScope({ id: 'user-1', role: 'admin' })
    expect(result).toBeNull()
  })
})

describe('buildLocationClause', () => {
  it('builds locationId clause for specific location', () => {
    const { clause, values } = buildLocationClause('loc-001', null, null)
    expect(clause).toBe('locationId = ?')
    expect(values).toEqual(['loc-001'])
  })

  it('builds practiceId subquery clause', () => {
    const { clause, values } = buildLocationClause(null, 'practice-001', null)
    expect(clause).toContain('practiceId = ?')
    expect(values).toContain('practice-001')
  })

  it('returns empty clause when no filters', () => {
    const { clause, values } = buildLocationClause(null, null, null)
    expect(clause).toBe('')
    expect(values).toHaveLength(0)
  })

  it('blocks access when requested location outside allowed scope', () => {
    const { clause } = buildLocationClause('loc-caac-001', null, ['loc-map-001', 'loc-map-002'])
    expect(clause).toContain('__BLOCKED__')
  })

  it('allows access when requested location within allowed scope', () => {
    const { clause, values } = buildLocationClause('loc-map-001', null, ['loc-map-001', 'loc-map-002'])
    expect(clause).toBe('locationId = ?')
    expect(values).toContain('loc-map-001')
  })

  it('restricts to allowed locations when no filter specified', () => {
    const { clause, values } = buildLocationClause(null, null, ['loc-map-001', 'loc-map-002'])
    expect(clause).toContain('IN')
    expect(values).toContain('loc-map-001')
  })
})
