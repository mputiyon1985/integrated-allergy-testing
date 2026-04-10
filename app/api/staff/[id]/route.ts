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
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, active, mfaEnabled, defaultLocationId FROM StaffUser WHERE id=? LIMIT 1`,
      id
    )
    if (!rows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const user = {
      id: rows[0].id as string,
      email: rows[0].email as string,
      name: rows[0].name as string,
      role: rows[0].role as string,
      active: Boolean(rows[0].active),
      mfaEnabled: Boolean(rows[0].mfaEnabled),
      defaultLocationId: rows[0].defaultLocationId as string | null,
    }
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

    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, active, mfaEnabled, defaultLocationId FROM StaffUser WHERE id=? LIMIT 1`,
      id
    )
    if (!existingRows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Self-protection: cannot downgrade own role
    if (id === session.userId && body.role && body.role !== 'admin') {
      return NextResponse.json({ error: 'Cannot downgrade your own role' }, { status: 400 })
    }

    // Self-protection: cannot deactivate yourself
    if (id === session.userId && body.active === false) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
    }

    const setClauses: string[] = []
    const values: unknown[] = []
    const updatedFields: string[] = []

    if (body.name !== undefined) {
      setClauses.push('name=?')
      values.push(body.name)
      updatedFields.push('name')
    }
    if (body.role !== undefined) {
      const role = body.role === 'admin' ? 'admin' : 'staff'
      setClauses.push('role=?')
      values.push(role)
      updatedFields.push('role')
    }
    if (body.active !== undefined) {
      setClauses.push('active=?')
      values.push(body.active ? 1 : 0)
      updatedFields.push('active')
    }
    if ('defaultLocationId' in body) {
      setClauses.push('defaultLocationId=?')
      values.push(body.defaultLocationId ?? null)
      updatedFields.push('defaultLocationId')
    }

    if (setClauses.length > 0) {
      setClauses.push('updatedAt=CURRENT_TIMESTAMP')
      values.push(id)
      await prisma.$executeRawUnsafe(
        `UPDATE StaffUser SET ${setClauses.join(', ')} WHERE id=?`,
        ...values
      )
    }

    // Fetch updated user
    const updatedRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, active, mfaEnabled, defaultLocationId FROM StaffUser WHERE id=? LIMIT 1`,
      id
    )
    const updated = updatedRows[0] ? {
      id: updatedRows[0].id as string,
      email: updatedRows[0].email as string,
      name: updatedRows[0].name as string,
      role: updatedRows[0].role as string,
      active: Boolean(updatedRows[0].active),
      mfaEnabled: Boolean(updatedRows[0].mfaEnabled),
      defaultLocationId: updatedRows[0].defaultLocationId as string | null,
    } : null

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_UPDATED',
        entity: 'StaffUser',
        entityId: id,
        details: `Updated by admin ${session.email as string}: ${updatedFields.join(', ')}`,
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
    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email FROM StaffUser WHERE id=? LIMIT 1`,
      id
    )
    if (!existingRows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await prisma.$executeRawUnsafe(
      `UPDATE StaffUser SET active=0, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      id
    )

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
