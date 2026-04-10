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

    // Find staff user — raw SQL to avoid Prisma DateTime mismatch on Turso
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, passwordHash, active, mfaEnabled, mfaSecret, defaultLocationId FROM StaffUser WHERE email=? LIMIT 1`,
      email
    )
    const user = rows[0] ? {
      id: rows[0].id as string,
      email: rows[0].email as string,
      name: rows[0].name as string,
      role: rows[0].role as string,
      passwordHash: rows[0].passwordHash as string,
      active: Boolean(rows[0].active),
      mfaEnabled: Boolean(rows[0].mfaEnabled),
      mfaSecret: rows[0].mfaSecret as string | null,
      defaultLocationId: rows[0].defaultLocationId as string | null,
    } : null

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      await log({ action: 'LOGIN_FAILED', entity: 'StaffUser', entityId: user.id, performedBy: user.name, details: `Failed password attempt for ${email}` })
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // If MFA is explicitly disabled for this user — issue session directly
    if (!user.mfaEnabled) {
      await log({ action: 'LOGIN_SUCCESS', entity: 'StaffUser', entityId: user.id, performedBy: user.name, details: `${user.name} (${user.email}) logged in (MFA disabled)` })
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

    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await prisma.$executeRawUnsafe(
      `UPDATE StaffUser SET tempToken=?, tempTokenExpiry=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      tempToken, expiry, user.id
    )

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
