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
    const users = await prisma.staffUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        active: true,
        mfaEnabled: true,
        defaultLocationId: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })
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

    const existing = await prisma.staffUser.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const validRoles = ['admin', 'provider', 'clinical_staff', 'front_desk', 'billing', 'office_manager', 'staff']
    const assignedRole = role && validRoles.includes(role) ? role : 'staff'

    const user = await prisma.staffUser.create({
      data: {
        email,
        name,
        passwordHash,
        role: assignedRole,
        ...(defaultLocationId ? { defaultLocationId } : {}),
      },
      select: {
        id: true, email: true, name: true, role: true,
        permissions: true, active: true, mfaEnabled: true,
        defaultLocationId: true, createdAt: true,
      },
    })

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_CREATED',
        entity: 'StaffUser',
        entityId: user.id,
        details: `User created via admin panel`,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
