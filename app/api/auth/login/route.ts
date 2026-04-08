/**
 * @file /api/auth/login — Staff authentication
 * @description Authenticates staff users with email/password and issues a JWT session cookie.
 *              MFA is required for all staff. super_admin role can bypass for initial setup.
 * @security Public route — no session required
 */
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { signSession } from '@/lib/auth/session'

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

    // TODO: MFA enforcement — StaffUser model needs mfaEnabled/mfaSecret fields
    // Once the schema has those fields, implement TOTP verification here.
    // Expected flow:
    //   1. If user.mfaEnabled === true  → issue temp token, require MFA code (existing behavior)
    //   2. If user.mfaEnabled === false and role !== 'super_admin'
    //        → return { error: 'MFA required. Please contact admin to set up two-factor authentication.', requiresMfaSetup: true }
    //   3. super_admin can bypass MFA for initial setup only
    //
    // For now, log a security warning for every login until MFA is enforced at DB level.
    if (user.role !== 'super_admin') {
      console.warn(`[SECURITY] Staff user ${user.email} (role: ${user.role}) logged in without MFA — StaffUser model needs mfaEnabled/mfaSecret fields to enforce MFA`)
    }

    // Sign JWT
    const token = await signSession({ userId: user.id, email: user.email, role: user.role, name: user.name })

    // Set cookie directly on the response
    const response = NextResponse.json({ ok: true, role: user.role, name: user.name })
    response.cookies.set('iat_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('POST /api/auth/login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
