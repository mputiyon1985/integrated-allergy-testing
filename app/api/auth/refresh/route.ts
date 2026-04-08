/**
 * @file /api/auth/refresh — Session token refresh
 * @description Rotates the JWT session token before it expires.
 *   POST — Verifies current session, issues a fresh 8-hour token.
 *   Called automatically by the client when token age > 6 hours.
 * @security Requires valid existing session cookie
 */
import { NextRequest, NextResponse } from 'next/server'
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
    const user = await prisma.staffUser.findUnique({
      where: { id: session.userId as string },
      select: { id: true, email: true, role: true, name: true, active: true },
    })

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Session invalid' }, { status: 401 })
    }

    // Issue fresh token
    const newToken = await signSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
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
