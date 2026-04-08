import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'iat-dev-secret-change-in-production-32c'
)
const SESSION_COOKIE = 'iat_session'
const PUBLIC_PATHS = ['/login', '/api/auth', '/consent', '/api/consent', '/api/health', '/kiosk', '/kiosk/update-info', '/api/kiosk', '/_next', '/favicon']
// Note: /api/seed and /api/allergens/seed are intentionally excluded from PUBLIC_PATHS in production.
// Waiting room GET (staff) is auth-protected; only POST is kiosk-facing and handled via /api/waiting-room POST with DB validation.

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)
    const headers = new Headers(req.headers)
    headers.set('x-user-id', payload.userId as string || '')
    headers.set('x-user-role', payload.role as string || '')
    return NextResponse.next({ request: { headers } })
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
