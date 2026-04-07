/**
 * @file /api/auth/login — Staff authentication
 * @description Authenticates staff users with email/password and issues a JWT session cookie.
 * @security Public route — no session required
 */
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { signSession, setSessionCookie } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; password?: string }
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Find staff user
    const user = await prisma.staffUser.findUnique({ where: { email } })

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Success: sign JWT and set session cookie
    const token = await signSession({ userId: user.id, email: user.email, role: user.role, name: user.name })
    await setSessionCookie(token)

    return NextResponse.json({ ok: true, role: user.role, name: user.name })
  } catch (error) {
    console.error('POST /api/auth/login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
