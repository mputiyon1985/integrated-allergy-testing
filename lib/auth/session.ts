/**
 * @file lib/auth/session.ts — JWT session management
 * @description Handles JWT creation, verification, and cookie management for staff authentication.
 *   - `signSession(payload)` — Creates a signed 8-hour JWT.
 *   - `verifySession(req)` — Validates the iat_session cookie from a request.
 *   - `setSessionCookie(token)` — Sets the HttpOnly session cookie.
 *   - `clearSessionCookie()` — Deletes the session cookie on logout.
 *   Secret is read from JWT_SECRET env var; falls back to a dev-only default.
 * @usage `import { verifySession } from '@/lib/auth/session'`
 */
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'iat-dev-secret-change-in-production-32c'
)
const COOKIE_NAME = 'iat_session'

export async function signSession(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(SECRET)
}

export async function verifySession(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const cookieHeader = req.headers.get('cookie') || ''
    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
    if (!match) return null
    const { payload } = await jwtVerify(match[1], SECRET)
    return payload as Record<string, unknown>
  } catch { return null }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
