import { NextRequest, NextResponse } from 'next/server'
import { validateCsrf } from '@/lib/csrf'
import { jwtVerify } from 'jose'

// NOTE: proxy.ts runs on the Edge runtime — cannot use Azure Key Vault (Node.js SDK).
// JWT_SECRET env var MUST be set on Vercel and must match the secret used in lib/auth/session.ts.
// If Azure Key Vault is configured, set JWT_SECRET to the same value as the Key Vault secret.
const SESSION_COOKIE = 'iat_session'

function getSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? 'iat-dev-secret-change-in-production-32c'
  )
}
const PUBLIC_PATHS = ['/login', '/api/auth', '/consent', '/api/consent', '/api/health', '/kiosk', '/kiosk/update-info', '/kiosk/services', '/api/kiosk', '/api/appointment-reasons', '/api/insurance-companies', '/_next', '/favicon']
// Note: /api/seed and /api/allergens/seed are intentionally excluded from PUBLIC_PATHS in production.
// Waiting room GET (staff) is auth-protected; only POST is kiosk-facing and handled via /api/waiting-room POST with DB validation.

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  // CSRF protection for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && pathname.startsWith('/api/')) {
    const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
    if (!isPublic) {
      const csrfError = validateCsrf(req)
      if (csrfError) return addSecurityHeaders(csrfError)
    }
  }


  function addSecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
    }
    return response
  }

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return addSecurityHeaders(NextResponse.next())
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, getSecret())
    const headers = new Headers(req.headers)
    headers.set('x-user-id', payload.userId as string || '')
    headers.set('x-user-role', payload.role as string || '')
    headers.set('x-location-id', payload.defaultLocationId as string || '')
    return addSecurityHeaders(NextResponse.next({ request: { headers } }))
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
