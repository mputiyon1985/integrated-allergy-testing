/**
 * @file /api/admin/users/[id] — Single staff user management
 * @description Endpoints for reading and updating individual staff users.
 *   GET   — Fetch single user.
 *   PATCH — Update role, name, active status, or permission overrides.
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(req, 'users_view')
  if (denied) return denied

  const { id } = await params

  try {
    const user = await prisma.staffUser.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, role: true,
        permissions: true, active: true, mfaEnabled: true,
        defaultLocationId: true, createdAt: true,
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json(user)
  } catch (error) {
    console.error('GET /api/admin/users/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(req, 'users_manage')
  if (denied) return denied

  const { id } = await params

  try {
    const body = await req.json() as {
      name?: string
      role?: string
      active?: boolean
      permissions?: Record<string, boolean> | null
      defaultLocationId?: string
    }

    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.active !== undefined) updateData.active = body.active
    if (body.defaultLocationId !== undefined) updateData.defaultLocationId = body.defaultLocationId

    if (body.role !== undefined) {
      const validRoles = ['admin', 'provider', 'clinical_staff', 'front_desk', 'billing', 'office_manager', 'staff']
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      updateData.role = body.role
    }

    if ('permissions' in body) {
      // null clears overrides; object is stored as JSON string
      updateData.permissions = body.permissions === null
        ? null
        : JSON.stringify(body.permissions)
    }

    const user = await prisma.staffUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, name: true, role: true,
        permissions: true, active: true, mfaEnabled: true,
        defaultLocationId: true, createdAt: true,
      },
    })

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_UPDATED',
        entity: 'StaffUser',
        entityId: user.id,
        details: `Updated fields: ${Object.keys(updateData).join(', ')}`,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('PATCH /api/admin/users/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
