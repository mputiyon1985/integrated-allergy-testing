/**
 * @file /api/admin/users — Admin user management
 * @description Endpoints for managing staff users (requires admin or users_manage permission).
 *   GET  — List all staff users with permissions data.
 *   POST — Create a new staff user.
 */
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = await requirePermission(req, 'users_view')
  if (denied) return denied

  try {
    const rawUsers = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, permissions, active, mfaEnabled, defaultLocationId FROM StaffUser ORDER BY name ASC`
    )
    const users = rawUsers.map(u => ({
      id: u.id as string,
      email: u.email as string,
      name: u.name as string,
      role: u.role as string,
      permissions: u.permissions as string | null,
      active: Boolean(u.active),
      mfaEnabled: Boolean(u.mfaEnabled),
      defaultLocationId: u.defaultLocationId as string | null,
    }))
    return NextResponse.json({ users })
  } catch (error) {
    console.error('GET /api/admin/users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, 'users_manage')
  if (denied) return denied

  try {
    const body = await req.json() as {
      email?: string
      name?: string
      password?: string
      role?: string
      defaultLocationId?: string
    }
    const { email, name, password, role, defaultLocationId } = body

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'email, name, and password are required' }, { status: 400 })
    }

    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id FROM StaffUser WHERE email=? LIMIT 1`,
      email
    )
    if (existingRows[0]) {
      return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const validRoles = ['admin', 'provider', 'clinical_staff', 'front_desk', 'billing', 'office_manager', 'staff']
    const assignedRole = role && validRoles.includes(role) ? role : 'staff'
    const newId = crypto.randomUUID()

    if (defaultLocationId) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO StaffUser (id, email, passwordHash, name, role, active, mfaEnabled, defaultLocationId, updatedAt) VALUES (?,?,?,?,?,1,0,?,CURRENT_TIMESTAMP)`,
        newId, email, passwordHash, name, assignedRole, defaultLocationId
      )
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO StaffUser (id, email, passwordHash, name, role, active, mfaEnabled, updatedAt) VALUES (?,?,?,?,?,1,0,CURRENT_TIMESTAMP)`,
        newId, email, passwordHash, name, assignedRole
      )
    }

    // Fetch the newly created user
    const newRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, permissions, active, mfaEnabled, defaultLocationId FROM StaffUser WHERE id=? LIMIT 1`,
      newId
    )
    const user = newRows[0] ? {
      id: newRows[0].id as string,
      email: newRows[0].email as string,
      name: newRows[0].name as string,
      role: newRows[0].role as string,
      permissions: newRows[0].permissions as string | null,
      active: Boolean(newRows[0].active),
      mfaEnabled: Boolean(newRows[0].mfaEnabled),
      defaultLocationId: newRows[0].defaultLocationId as string | null,
    } : { id: newId, email, name, role: assignedRole, permissions: null, active: true, mfaEnabled: false, defaultLocationId: defaultLocationId ?? null }

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_CREATED',
        entity: 'StaffUser',
        entityId: newId,
        details: `User created via admin panel`,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
