/**
 * @file /api/staff — Staff user administration
 * @description Admin-only endpoints for managing staff accounts.
 *   GET  — List all staff users (admin only).
 *   POST — Create a new staff user with email, name, password, and optional role (admin only).
 * @security Requires authenticated session with admin role (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
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

    // Check for existing user
    const existing = await prisma.staffUser.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.staffUser.create({
      data: {
        email,
        name,
        passwordHash,
        role: role === 'admin' ? 'admin' : 'staff',
        ...(defaultLocationId ? { defaultLocationId } : {}),
      },
      select: { id: true, email: true, name: true, role: true, active: true, mfaEnabled: true, defaultLocationId: true, createdAt: true },
    })

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_CREATED',
        entity: 'StaffUser',
        entityId: user.id,
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
    const users = await prisma.staffUser.findMany({
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
      orderBy: { name: 'asc' },
    })

    // Enrich with location names
    const locationIds = [...new Set(users.map(u => u.defaultLocationId).filter(Boolean))] as string[]
    let locationMap: Record<string, string> = {}
    if (locationIds.length > 0) {
      const locs = await prisma.location.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, name: true },
      })
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
