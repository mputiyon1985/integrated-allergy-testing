/**
 * @file /api/auth/logout — Session termination
 * @description Clears the iat_session cookie to log the user out.
 *   POST — Delete the session cookie.
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function POST() {
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
