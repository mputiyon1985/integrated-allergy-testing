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
    const location = await prisma.location.findFirst({
      where: { id, deletedAt: null },
    })
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }
    return NextResponse.json(location)
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
    }

    const existing = await prisma.location.findFirst({ where: { id, deletedAt: null } })
    if (!existing) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const location = await prisma.location.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.key !== undefined ? { key: body.key } : {}),
        ...(body.suite !== undefined ? { suite: body.suite } : {}),
        ...(body.street !== undefined ? { street: body.street } : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.state !== undefined ? { state: body.state } : {}),
        ...(body.zip !== undefined ? { zip: body.zip } : {}),
        ...(body.active !== undefined ? {
          active: body.active,
          ...(body.active ? { deletedAt: null } : {}),
        } : {}),
      },
    })

    prisma.auditLog.create({
      data: {
        action: 'LOCATION_UPDATED',
        entity: 'Location',
        entityId: location.id,
        patientId: null,
        details: `Location updated: ${location.name} (${location.key})`,
      },
    }).catch(() => {})

    return NextResponse.json(location)
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
    const existing = await prisma.location.findFirst({ where: { id, deletedAt: null } })
    if (!existing) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const location = await prisma.location.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    })

    return NextResponse.json(location)
  } catch (error) {
    console.error('DELETE /api/locations/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
