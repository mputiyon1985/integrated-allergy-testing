/**
 * @file /api/staff/[id] — Individual staff user operations
 * @description Admin-only endpoints for managing a specific staff account.
 *   GET    — Get a single staff user by ID (admin only).
 *   PUT    — Update staff user fields: name, role, active, defaultLocationId (admin only).
 *   DELETE — Deactivate (soft-delete) a staff user (admin only).
 * @security Requires authenticated session with admin role
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifySession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })

  const { id } = await params

  try {
    const user = await prisma.staffUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        mfaEnabled: true,
        defaultLocationId: true,
        createdAt: true,
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json(user)
  } catch (error) {
    console.error('GET /api/staff/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json() as {
      name?: string
      role?: string
      active?: boolean
      defaultLocationId?: string | null
    }

    const existing = await prisma.staffUser.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Self-protection: cannot downgrade own role
    if (id === session.userId && body.role && body.role !== 'admin') {
      return NextResponse.json({ error: 'Cannot downgrade your own role' }, { status: 400 })
    }

    // Self-protection: cannot deactivate yourself
    if (id === session.userId && body.active === false) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.role !== undefined) updateData.role = body.role === 'admin' ? 'admin' : 'staff'
    if (body.active !== undefined) updateData.active = body.active
    if ('defaultLocationId' in body) updateData.defaultLocationId = body.defaultLocationId ?? null

    const updated = await prisma.staffUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        mfaEnabled: true,
        defaultLocationId: true,
        createdAt: true,
      },
    })

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_UPDATED',
        entity: 'StaffUser',
        entityId: id,
        details: `Updated by admin ${session.email as string}: ${Object.keys(updateData).join(', ')}`,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT /api/staff/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })

  const { id } = await params

  if (id === session.userId) {
    return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
  }

  try {
    const existing = await prisma.staffUser.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await prisma.staffUser.update({ where: { id }, data: { active: false } })

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_DEACTIVATED',
        entity: 'StaffUser',
        entityId: id,
        details: `Deactivated by admin ${session.email as string}`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/staff/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
