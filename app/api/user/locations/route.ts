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

    let locations
    if (accessRows.length === 0) {
      // Fallback: return all active locations (admin / first-run)
      locations = await prisma.location.findMany({
        where: { deletedAt: null, active: true },
        include: { practice: { select: { id: true, name: true, shortName: true } } },
        orderBy: { name: 'asc' },
      })
    } else {
      const locationIds = accessRows.map((r) => r.locationId)
      locations = await prisma.location.findMany({
        where: { id: { in: locationIds }, deletedAt: null },
        include: { practice: { select: { id: true, name: true, shortName: true } } },
        orderBy: { name: 'asc' },
      })
    }

    // Get user's defaultLocationId
    const user = await prisma.staffUser.findUnique({
      where: { id: userId },
      select: { defaultLocationId: true },
    })
    const defaultLocationId = user?.defaultLocationId ?? locations[0]?.id ?? 'loc-iat-001'

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
