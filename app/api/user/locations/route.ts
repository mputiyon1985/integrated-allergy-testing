/**
 * @file /api/user/locations — Returns locations accessible to the current user
 * @description Looks up UserLocationAccess for the calling user and returns their
 *   accessible locations plus the default location, with the parent practice info.
 *   userId is read from the x-user-id header set by proxy.ts.
 * @security Requires authenticated session
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's accessible locations via UserLocationAccess
    const accessRows = await prisma.userLocationAccess.findMany({
      where: { userId },
    })

    let locationRows: Array<Record<string, unknown>>
    if (accessRows.length === 0) {
      // Fallback: return all active locations (admin / first-run)
      locationRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT l.*, p.id as practiceId_join, p.name as practiceName, p.shortName as practiceShortName
         FROM Location l
         LEFT JOIN Practice p ON p.id = l.practiceId
         WHERE l.deletedAt IS NULL AND l.active = 1
         ORDER BY l.name ASC`
      )
    } else {
      const locationIds = accessRows.map((r) => r.locationId)
      const placeholders = locationIds.map(() => '?').join(',')
      locationRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT l.*, p.id as practiceId_join, p.name as practiceName, p.shortName as practiceShortName
         FROM Location l
         LEFT JOIN Practice p ON p.id = l.practiceId
         WHERE l.id IN (${placeholders}) AND l.deletedAt IS NULL
         ORDER BY l.name ASC`,
        ...locationIds
      )
    }

    // Map to expected shape
    const locations = locationRows.map(l => ({
      id: l.id,
      name: l.name,
      key: l.key,
      active: l.active,
      city: l.city,
      state: l.state,
      street: l.street,
      zip: l.zip,
      suite: l.suite,
      practiceId: l.practiceId,
      practice: l.practiceName ? {
        id: l.practiceId,
        name: l.practiceName,
        shortName: l.practiceShortName ?? null,
      } : null,
    }))

    // Get user's defaultLocationId using raw SQL to avoid DateTime parsing issues
    const userRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT defaultLocationId FROM StaffUser WHERE id=? LIMIT 1`,
      userId
    )
    const defaultLocationId = (userRows[0]?.defaultLocationId as string | null) ?? locations[0]?.id ?? 'loc-iat-001'

    // Derive practice from the default location (or first location)
    const defaultLoc = locations.find((l) => l.id === defaultLocationId) ?? locations[0]
    const practice = defaultLoc?.practice ?? null

    return NextResponse.json({
      practice,
      locations,
      defaultLocationId,
    })
  } catch (error) {
    console.error('GET /api/user/locations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
