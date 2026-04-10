/**
 * @file /api/user/locations/default — Update the user's default location
 * @description PUT { locationId } — persists the new default to StaffUser.defaultLocationId
 * @security Requires authenticated session
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { locationId?: string }
    if (!body.locationId) {
      return NextResponse.json({ error: 'locationId is required' }, { status: 400 })
    }

    // Verify user has access to this location
    const access = await prisma.userLocationAccess.findFirst({
      where: { userId, locationId: body.locationId },
    })
    // Also allow if user has no explicit access rows (admin fallback)
    const accessCount = await prisma.userLocationAccess.count({ where: { userId } })
    if (!access && accessCount > 0) {
      return NextResponse.json({ error: 'Access denied to this location' }, { status: 403 })
    }

    await prisma.$executeRawUnsafe(
      `UPDATE StaffUser SET defaultLocationId=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      body.locationId, userId
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/user/locations/default error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
