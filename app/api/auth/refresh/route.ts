/**
 * @file /api/auth/refresh — Session token refresh
 * @description Rotates the JWT session token before it expires.
 *   POST — Verifies current session, issues a fresh 8-hour token.
 *   Called automatically by the client when token age > 6 hours.
 * @security Requires valid existing session cookie
 */
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_LOCATION_ID } from '@/lib/defaults'
import { verifySession, signSession, setSessionCookie } from '@/lib/auth/session'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req)
    if (!session) {
      return NextResponse.json({ error: 'No valid session' }, { status: 401 })
    }

    // Verify user still exists and is active
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, active, defaultLocationId FROM StaffUser WHERE id=? LIMIT 1`,
      session.userId as string
    )
    const user = rows[0] ? {
      id: rows[0].id as string,
      email: rows[0].email as string,
      name: rows[0].name as string,
      role: rows[0].role as string,
      active: Boolean(rows[0].active),
      defaultLocationId: rows[0].defaultLocationId as string | null,
    } : null

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Session invalid' }, { status: 401 })
    }

    // Issue fresh token
    const newToken = await signSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      defaultLocationId: user.defaultLocationId ?? DEFAULT_LOCATION_ID,
    })

    const response = NextResponse.json({ ok: true, refreshed: true })
    response.cookies.set('iat_session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('POST /api/auth/refresh error:', error)
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
  }
}
