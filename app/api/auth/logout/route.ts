import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/audit'
import { verifySession } from '@/lib/auth/session'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req)
    if (session?.userId) {
      await log({ action: 'LOGOUT', entity: 'StaffUser', entityId: session.userId as string, details: `${session.name ?? session.email} logged out` })
    }
  } catch { /* non-fatal */ }
  const response = NextResponse.json({ ok: true })
  response.cookies.set('iat_session', '', { maxAge: 0, path: '/' })
  return response
}
