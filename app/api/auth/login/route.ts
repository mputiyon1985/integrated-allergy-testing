/**
 * @file /api/auth/login — Staff authentication
 * @description Authenticates staff users with email/password, then issues either a
 *              temp token for MFA verification/setup or a direct session (super_admin only).
 *              MFA is enforced for all staff roles.
 * @security Public route — no session required
 */
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import prisma from '@/lib/db'
import { log } from '@/lib/audit'
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
      await log({ action: 'LOGIN_FAILED', entity: 'StaffUser', entityId: user.id, details: `Failed password attempt for ${email}` })
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // If MFA is explicitly disabled for this user — issue session directly
    if (!user.mfaEnabled) {
      await log({ action: 'LOGIN_SUCCESS', entity: 'StaffUser', entityId: user.id, details: `${user.name} (${user.email}) logged in (MFA disabled)` })
      const token = await signSession({
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        defaultLocationId: (user as Record<string, unknown>).defaultLocationId as string ?? 'loc-iat-001',
      })
      const response = NextResponse.json({ success: true, role: user.role, name: user.name })
      response.cookies.set('iat_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 8,
        path: '/',
      })
      return response
    }

    // Issue temp token for MFA flow
    const tempToken = randomUUID()
    const tempTokenExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    await prisma.staffUser.update({
      where: { id: user.id },
      data: { tempToken, tempTokenExpiry },
    })

    if (!user.mfaSecret) {
      // MFA enabled but not yet configured — send to setup flow
      return NextResponse.json({ requiresMfaSetup: true, tempToken })
    }

    // MFA enabled + configured — require TOTP verification
    return NextResponse.json({ requiresMfa: true, tempToken })
  } catch (error) {
    console.error('POST /api/auth/login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
