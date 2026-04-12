/**
 * @file /api/locations/[id] — Single location operations
 * @description
 *   GET    — Fetch a single location by ID.
 *   PUT    — Update location fields (including active/deletedAt for deactivate).
 *   DELETE — Soft delete (set deletedAt).
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Location WHERE id = ? AND deletedAt IS NULL`, id
    )
    if (!rows[0]) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }
    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('GET /api/locations/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(request, 'locations_manage')
  if (denied) return denied
  try {
    const { id } = await params
    const body = await request.json() as {
      name?: string
      key?: string
      suite?: string | null
      street?: string
      city?: string
      state?: string
      zip?: string
      active?: boolean
      practiceId?: string | null
    }

    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id FROM Location WHERE id = ? AND deletedAt IS NULL`, id
    )
    if (!existingRows[0]) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    // Handle deletedAt: if setting active=true, clear deletedAt
    const clearDeletedAt = body.active === true ? now : null
    const setDeletedAt = body.active === false ? now : null

    await prisma.$executeRaw`UPDATE Location SET
      name = COALESCE(${body.name ?? null}, name),
      key = COALESCE(${body.key ?? null}, key),
      suite = CASE WHEN ${body.suite !== undefined ? 1 : 0} = 1 THEN ${body.suite ?? null} ELSE suite END,
      street = COALESCE(${body.street ?? null}, street),
      city = COALESCE(${body.city ?? null}, city),
      state = COALESCE(${body.state ?? null}, state),
      zip = COALESCE(${body.zip ?? null}, zip),
      active = COALESCE(${body.active !== undefined ? (body.active ? 1 : 0) : null}, active),
      deletedAt = CASE
        WHEN ${clearDeletedAt !== null ? 1 : 0} = 1 THEN NULL
        WHEN ${setDeletedAt !== null ? 1 : 0} = 1 THEN ${setDeletedAt}
        ELSE deletedAt
      END,
      updatedAt = ${now}
    WHERE id = ${id}`

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Location WHERE id = ?`, id
    )

    prisma.auditLog.create({
      data: {
        action: 'LOCATION_UPDATED',
        entity: 'Location',
        entityId: id,
        patientId: null,
        details: `Location updated: ${rows[0]?.name ?? id}`,
      },
    }).catch((e: unknown) => console.error('[audit]', e))

    return NextResponse.json(rows[0] ?? { id })
  } catch (error) {
    console.error('PUT /api/locations/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(request, 'locations_manage')
  if (denied) return denied
  try {
    const { id } = await params
    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, name, key FROM Location WHERE id = ? AND deletedAt IS NULL`, id
    )
    if (!existingRows[0]) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    await prisma.$executeRaw`UPDATE Location SET deletedAt = ${now}, active = 0, updatedAt = ${now} WHERE id = ${id}`

    return NextResponse.json({ ...existingRows[0], deletedAt: now, active: false })
  } catch (error) {
    console.error('DELETE /api/locations/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
