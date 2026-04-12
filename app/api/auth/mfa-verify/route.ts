/**
 * @file /api/auth/mfa-verify — TOTP verification during login
 * @description Verifies a TOTP code for a user who has MFA already enabled.
 *              On success, issues a full session JWT cookie and clears the temp token.
 * @security Requires valid tempToken (issued by /api/auth/login)
 */
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_LOCATION_ID } from '@/lib/defaults'
import speakeasy from 'speakeasy'
import prisma from '@/lib/db'
import { signSession } from '@/lib/auth/session'
import { log } from '@/lib/audit'

const mfaAttempts = new Map<string, { count: number; resetAt: number }>()
function checkMfaRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = mfaAttempts.get(ip)
  if (!entry || now > entry.resetAt) { mfaAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); return true }
  if (entry.count >= 10) return false
  entry.count++; return true
}


export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkMfaRateLimit(ip)) return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
  try {
    const body = await req.json() as { tempToken?: string; code?: string }
    const { tempToken, code } = body

    if (!tempToken || !code) {
      return NextResponse.json({ error: 'tempToken and code are required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const users = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM StaffUser WHERE tempToken=? AND tempTokenExpiry > ? AND active=1 LIMIT 1`,
      tempToken, now
    )
    const user = users[0] ? {
      id: users[0].id as string,
      email: users[0].email as string,
      name: users[0].name as string,
      role: users[0].role as string,
      mfaSecret: users[0].mfaSecret as string | null,
      defaultLocationId: users[0].defaultLocationId as string | null,
    } : null

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    if (!user.mfaSecret) {
      return NextResponse.json({ error: 'MFA not configured for this account' }, { status: 400 })
    }

    // Verify TOTP code
    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    })

    if (!valid) {
      await log({ action: 'LOGIN_FAILED', entity: 'StaffUser', entityId: user.id, performedBy: user.name, details: `MFA verification failed for ${user.email}` })
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    // Clear temp token
    await prisma.$executeRawUnsafe(
      `UPDATE StaffUser SET tempToken=NULL, tempTokenExpiry=NULL, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      user.id
    )

    // Issue session JWT
    const token = await signSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      defaultLocationId: user.defaultLocationId ?? DEFAULT_LOCATION_ID,
    })

    await log({ action: 'LOGIN_SUCCESS', entity: 'StaffUser', entityId: user.id, performedBy: user.name, details: `${user.name} (${user.email}) logged in via MFA` })

    const response = NextResponse.json({ success: true, role: user.role, name: user.name })
    response.cookies.set('iat_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('POST /api/auth/mfa-verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
