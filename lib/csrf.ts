/**
 * CSRF protection utilities.
 * 
 * Strategy: Double-submit cookie pattern.
 * - On login, we set a non-httpOnly `iat_csrf` cookie with a random token
 * - All state-changing requests (POST/PUT/DELETE) must include X-CSRF-Token header
 *   matching the cookie value
 * - Since sameSite: strict is already set on the session cookie, this is belt-and-suspenders
 * 
 * Note: GET requests are safe (no state changes) and don't need CSRF protection.
 */

import { NextRequest, NextResponse } from 'next/server'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate CSRF token on state-changing requests.
 * Returns null if valid, or a 403 response if invalid.
 */
export function validateCsrf(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase()
  
  // Only validate state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) return null
  
  // Skip CSRF for kiosk routes (no session cookie, different auth model)
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/kiosk') || pathname.startsWith('/api/auth/login')) return null
  
  // In development, skip CSRF to avoid friction
  if (process.env.NODE_ENV !== 'production') return null

  const headerToken = request.headers.get('X-CSRF-Token')
  const cookieToken = request.cookies.get('iat_csrf')?.value

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403, headers: HIPAA_HEADERS }
    )
  }

  return null // valid
}
