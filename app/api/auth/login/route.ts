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

    // Issue temp token for MFA flow
    const tempToken = randomUUID()
    const tempTokenExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    await prisma.staffUser.update({
      where: { id: user.id },
      data: { tempToken, tempTokenExpiry },
    })

    if (!user.mfaEnabled || !user.mfaSecret) {
      // MFA not yet set up — send to setup flow
      return NextResponse.json({ requiresMfaSetup: true, tempToken })
    }

    // MFA enabled — require TOTP verification
    return NextResponse.json({ requiresMfa: true, tempToken })
  } catch (error) {
    console.error('POST /api/auth/login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
