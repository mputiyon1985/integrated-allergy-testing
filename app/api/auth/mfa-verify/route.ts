/**
 * @file /api/auth/mfa-verify — TOTP verification during login
 * @description Verifies a TOTP code for a user who has MFA already enabled.
 *              On success, issues a full session JWT cookie and clears the temp token.
 * @security Requires valid tempToken (issued by /api/auth/login)
 */
import { NextRequest, NextResponse } from 'next/server'
import speakeasy from 'speakeasy'
import prisma from '@/lib/db'
import { signSession } from '@/lib/auth/session'
import { log } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { tempToken?: string; code?: string }
    const { tempToken, code } = body

    if (!tempToken || !code) {
      return NextResponse.json({ error: 'tempToken and code are required' }, { status: 400 })
    }

    const user = await prisma.staffUser.findFirst({
      where: {
        tempToken,
        tempTokenExpiry: { gte: new Date() },
        active: true,
      },
    })

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
      await log({ action: 'LOGIN_FAILED', entity: 'StaffUser', entityId: user.id, details: `MFA verification failed for ${user.email}` })
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    // Clear temp token
    await prisma.staffUser.update({
      where: { id: user.id },
      data: {
        tempToken: null,
        tempTokenExpiry: null,
      },
    })

    // Issue session JWT
    const token = await signSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      defaultLocationId: user.defaultLocationId ?? 'loc-iat-001',
    })

    await log({ action: 'LOGIN_SUCCESS', entity: 'StaffUser', entityId: user.id, details: `${user.name} (${user.email}) logged in via MFA` })

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
