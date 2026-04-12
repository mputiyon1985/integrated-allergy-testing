/**
 * @file /api/staff — Staff user administration
 * @description Admin-only endpoints for managing staff accounts.
 *   GET  — List all staff users (admin only).
 *   POST — Create a new staff user with email, name, password, and optional role (admin only).
 * @security Requires authenticated session with admin role (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import { validatePassword } from '@/lib/password-policy'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { verifySession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Verify session and admin role
  const session = await verifySession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
  }

  try {
    const body = await req.json() as { email?: string; name?: string; password?: string; role?: string; defaultLocationId?: string }
    const { email, name, password, role, defaultLocationId } = body

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'email, name, and password are required' }, { status: 400 })
    }

    // Check for existing user using raw SQL
    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id FROM StaffUser WHERE email=? LIMIT 1`,
      email
    )
    if (existingRows[0]) {
      return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
    }

    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) return NextResponse.json({ error: pwCheck.errors.join('. ') }, { status: 400 })
    const passwordHash = await bcrypt.hash(password, 12)
    const assignedRole = role === 'admin' ? 'admin' : 'staff'
    const newId = crypto.randomUUID()

    if (defaultLocationId) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO StaffUser (id, email, passwordHash, name, role, active, mfaEnabled, defaultLocationId, updatedAt) VALUES (?,?,?,?,?,1,1,?,CURRENT_TIMESTAMP)`,
        newId, email, passwordHash, name, assignedRole, defaultLocationId
      )
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO StaffUser (id, email, passwordHash, name, role, active, mfaEnabled, updatedAt) VALUES (?,?,?,?,?,1,1,CURRENT_TIMESTAMP)`,
        newId, email, passwordHash, name, assignedRole
      )
    }

    // Fetch the newly created user
    const newRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, active, mfaEnabled, defaultLocationId FROM StaffUser WHERE id=? LIMIT 1`,
      newId
    )
    const user = newRows[0] ? {
      id: newRows[0].id as string,
      email: newRows[0].email as string,
      name: newRows[0].name as string,
      role: newRows[0].role as string,
      active: Boolean(newRows[0].active),
      mfaEnabled: Boolean(newRows[0].mfaEnabled),
      defaultLocationId: newRows[0].defaultLocationId as string | null,
    } : { id: newId, email, name, role: assignedRole, active: true, mfaEnabled: false, defaultLocationId: defaultLocationId ?? null }

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_CREATED',
        entity: 'StaffUser',
        entityId: newId,
        details: `Created by admin ${session.email as string}`,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('POST /api/staff error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
  }

  try {
    const rawUsers = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, active, mfaEnabled, defaultLocationId FROM StaffUser ORDER BY name ASC`
    )

    const users = rawUsers.map(u => ({
      id: u.id as string,
      email: u.email as string,
      name: u.name as string,
      role: u.role as string,
      active: Boolean(u.active),
      mfaEnabled: Boolean(u.mfaEnabled),
      defaultLocationId: u.defaultLocationId as string | null,
    }))

    // Enrich with location names (raw SQL — Location has DateTime fields)
    const locationIds = [...new Set(users.map(u => u.defaultLocationId).filter(Boolean))] as string[]
    let locationMap: Record<string, string> = {}
    if (locationIds.length > 0) {
      const placeholders = locationIds.map(() => '?').join(',')
      const locs = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
        `SELECT id, name FROM Location WHERE id IN (${placeholders})`,
        ...locationIds
      )
      locationMap = Object.fromEntries(locs.map(l => [l.id, l.name]))
    }

    const enriched = users.map(u => ({
      ...u,
      defaultLocationName: u.defaultLocationId ? (locationMap[u.defaultLocationId] ?? null) : null,
    }))

    return NextResponse.json({ staff: enriched })
  } catch (error) {
    console.error('GET /api/staff error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
