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

/**
 * Generates a cryptographically random 64-character hex CSRF token.
 *
 * Uses `crypto.getRandomValues` (Web Crypto API, available in both
 * Node.js ≥ 18 and Edge runtimes).
 *
 * @returns A 64-character lowercase hex string suitable for use as a CSRF token.
 *
 * @example
 * ```ts
 * const token = generateCsrfToken()
 * // e.g. 'a3f2...c8d1' (64 chars)
 * ```
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Validates the CSRF token on state-changing HTTP requests (POST/PUT/DELETE/PATCH).
 *
 * Implements the double-submit cookie pattern:
 * - Reads `X-CSRF-Token` from request headers.
 * - Compares it to the `iat_csrf` cookie value.
 * - Returns `null` (valid) or a `403 NextResponse` (invalid/missing token).
 *
 * Automatically skips validation for:
 * - Safe methods (GET, HEAD, OPTIONS)
 * - Kiosk routes (`/api/kiosk/*`)
 * - Login route (`/api/auth/login`)
 * - Non-production environments (NODE_ENV !== 'production')
 *
 * @param request - The incoming Next.js `NextRequest` object.
 * @returns `null` if the CSRF check passes, or a `NextResponse` with status 403 if it fails.
 *
 * @example
 * ```ts
 * // In middleware or API route:
 * const csrfError = validateCsrf(request)
 * if (csrfError) return csrfError
 * ```
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
