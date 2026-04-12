/**
 * @file /api/auth/mfa-setup — TOTP MFA setup
 * @description Two-phase MFA enrollment for staff users.
 *   GET  — Generates a new TOTP secret and returns the QR code data URL.
 *           Requires x-temp-token header (issued by /api/auth/login).
 *   POST — Verifies a TOTP code against the provided secret and, if valid,
 *           persists the secret, enables MFA, and issues a full session cookie.
 * @security Requires valid tempToken (not expired, active user)
 */
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_LOCATION_ID } from '@/lib/defaults'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import prisma from '@/lib/db'
import { signSession } from '@/lib/auth/session'
import { log } from '@/lib/audit'

export const dynamic = 'force-dynamic'

async function findUserByTempToken(tempToken: string) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id, email, name, role, mfaEnabled, mfaSecret, defaultLocationId FROM StaffUser WHERE tempToken=? AND active=1 LIMIT 1`,
    tempToken
  )
  if (!rows[0]) return null
  return {
    id: rows[0].id as string,
    email: rows[0].email as string,
    name: rows[0].name as string,
    role: rows[0].role as string,
    mfaEnabled: Boolean(rows[0].mfaEnabled),
    mfaSecret: rows[0].mfaSecret as string | null,
    defaultLocationId: rows[0].defaultLocationId as string | null,
  }
}

export async function GET(req: NextRequest) {
  const tempToken = req.headers.get('x-temp-token')
  if (!tempToken) {
    return NextResponse.json({ error: 'Missing temp token' }, { status: 401 })
  }

  const user = await findUserByTempToken(tempToken)

  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const secret = speakeasy.generateSecret({
    name: `IAT (${user.email})`,
    length: 32,
  })

  const qrCode = await QRCode.toDataURL(secret.otpauth_url!)

  return NextResponse.json({ secret: secret.base32, qrCode })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { tempToken?: string; secret?: string; code?: string }
    const { tempToken, secret, code } = body

    if (!tempToken || !secret || !code) {
      return NextResponse.json({ error: 'tempToken, secret, and code are required' }, { status: 400 })
    }

    const user = await findUserByTempToken(tempToken)

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Verify the TOTP code against the provided secret
    const valid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    })

    if (!valid) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    // Save MFA secret, enable MFA, clear temp token
    await prisma.$executeRawUnsafe(
      `UPDATE StaffUser SET mfaSecret=?, mfaEnabled=1, tempToken=NULL, tempTokenExpiry=NULL, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      secret, user.id
    )

    // Issue session JWT
    const token = await signSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      defaultLocationId: user.defaultLocationId ?? DEFAULT_LOCATION_ID,
    })

    await log({ action: 'LOGIN_SUCCESS', entity: 'StaffUser', entityId: user.id, performedBy: user.name, details: `${user.name} (${user.email}) completed MFA setup and logged in` })

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
    console.error('POST /api/auth/mfa-setup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
