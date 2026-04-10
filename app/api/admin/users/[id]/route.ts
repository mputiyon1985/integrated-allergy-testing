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
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, permissions, active, mfaEnabled, defaultLocationId FROM StaffUser WHERE id=? LIMIT 1`,
      id
    )
    if (!rows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const user = {
      id: rows[0].id as string,
      email: rows[0].email as string,
      name: rows[0].name as string,
      role: rows[0].role as string,
      permissions: rows[0].permissions as string | null,
      active: Boolean(rows[0].active),
      mfaEnabled: Boolean(rows[0].mfaEnabled),
      defaultLocationId: rows[0].defaultLocationId as string | null,
    }
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

    const setClauses: string[] = []
    const values: unknown[] = []
    const updatedFields: string[] = []

    if (body.name !== undefined) {
      setClauses.push('name=?')
      values.push(body.name)
      updatedFields.push('name')
    }
    if (body.active !== undefined) {
      setClauses.push('active=?')
      values.push(body.active ? 1 : 0)
      updatedFields.push('active')
    }
    if (body.defaultLocationId !== undefined) {
      setClauses.push('defaultLocationId=?')
      values.push(body.defaultLocationId)
      updatedFields.push('defaultLocationId')
    }

    if (body.role !== undefined) {
      const validRoles = ['admin', 'provider', 'clinical_staff', 'front_desk', 'billing', 'office_manager', 'staff']
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      setClauses.push('role=?')
      values.push(body.role)
      updatedFields.push('role')
    }

    if ('permissions' in body) {
      // null clears overrides; object is stored as JSON string
      setClauses.push('permissions=?')
      values.push(body.permissions === null ? null : JSON.stringify(body.permissions))
      updatedFields.push('permissions')
    }

    if (setClauses.length > 0) {
      setClauses.push('updatedAt=CURRENT_TIMESTAMP')
      values.push(id)
      await prisma.$executeRawUnsafe(
        `UPDATE StaffUser SET ${setClauses.join(', ')} WHERE id=?`,
        ...values
      )
    }

    // Fetch the updated user
    const updatedRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, permissions, active, mfaEnabled, defaultLocationId FROM StaffUser WHERE id=? LIMIT 1`,
      id
    )
    const user = updatedRows[0] ? {
      id: updatedRows[0].id as string,
      email: updatedRows[0].email as string,
      name: updatedRows[0].name as string,
      role: updatedRows[0].role as string,
      permissions: updatedRows[0].permissions as string | null,
      active: Boolean(updatedRows[0].active),
      mfaEnabled: Boolean(updatedRows[0].mfaEnabled),
      defaultLocationId: updatedRows[0].defaultLocationId as string | null,
    } : null

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_UPDATED',
        entity: 'StaffUser',
        entityId: id,
        details: `Updated fields: ${updatedFields.join(', ')}`,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('PATCH /api/admin/users/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
