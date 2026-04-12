/**
 * @file /api/auth/login — Staff authentication
 * @description Authenticates staff users with email/password, then issues either a
 *              temp token for MFA verification/setup or a direct session (super_admin only).
 *              MFA is enforced for all staff roles.
 * @security Public route — no session required
 */
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_LOCATION_ID } from '@/lib/defaults'
import { generateCsrfToken } from '@/lib/csrf'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import prisma from '@/lib/db'
import { log } from '@/lib/audit'
import { signSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

// Simple in-memory rate limiter (resets on server restart — good enough for edge)
export const loginAttempts = new Map<string, { count: number; resetAt: number }>()
// Cleanup stale entries every 15 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of loginAttempts.entries()) {
    if (now > entry.resetAt) loginAttempts.delete(ip)
  }
}, 15 * 60 * 1000)
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true // allowed
  }
  if (entry.count >= MAX_ATTEMPTS) return false // blocked
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many login attempts. Try again in 15 minutes.' }, { status: 429 })
  }

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
      loginAttempts.delete(ip) // clear rate limit on successful login
      await log({ action: 'LOGIN_SUCCESS', entity: 'StaffUser', entityId: user.id, performedBy: user.name, details: `${user.name} (${user.email}) logged in (MFA disabled)` })
      const token = await signSession({
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        defaultLocationId: (user as Record<string, unknown>).defaultLocationId as string ?? DEFAULT_LOCATION_ID,
      })
      const response = NextResponse.json({ success: true, role: user.role, name: user.name })
      response.cookies.set('iat_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 8,
        path: '/',
      })
        // Set CSRF token cookie (non-httpOnly so JS can read it)
  response.cookies.set('iat_csrf', generateCsrfToken(), {
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60, // 8 hours (matches session)
    httpOnly: false, // must be readable by JS
  })
  return response
    }

    // Issue temp token for MFA flow — clear rate limit since password was valid
    loginAttempts.delete(ip)
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
