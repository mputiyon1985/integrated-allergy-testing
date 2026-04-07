/**
 * @file /api/auth/me — Current session user info
 * @description Returns the authenticated staff user's profile.
 *   GET — Verify session and return id, email, name, role for the logged-in user.
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifySession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await verifySession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.staffUser.findUnique({
      where: { id: session.userId as string },
      select: { id: true, email: true, name: true, role: true, active: true },
    })

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('GET /api/auth/me error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
