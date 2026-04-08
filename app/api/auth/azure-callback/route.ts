import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { signSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

const ALLOWED_DOMAINS = ['tipinc.ai']

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL('/login?error=no_session', req.url))
    }

    const email = session.user.email
    const domain = email.split('@')[1]?.toLowerCase()

    if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
      return NextResponse.redirect(new URL('/login?error=unauthorized_domain', req.url))
    }

    // Find or create staff user
    let staffUser = await prisma.staffUser.findUnique({ where: { email } })
    if (!staffUser) {
      staffUser = await prisma.staffUser.create({
        data: {
          email,
          name: session.user.name || email.split('@')[0],
          passwordHash: 'sso-no-password', // SSO users don't use password
          role: 'staff',
          mfaEnabled: true, // Azure AD handles MFA
          active: true,
        },
      })
    }

    if (!staffUser.active) {
      return NextResponse.redirect(new URL('/login?error=account_disabled', req.url))
    }

    // Issue our app JWT
    const token = await signSession({
      userId: staffUser.id,
      email: staffUser.email,
      role: staffUser.role,
      name: staffUser.name,
      provider: 'azure',
    })

    const response = NextResponse.redirect(new URL('/', req.url))
    response.cookies.set('iat_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8,
      path: '/',
    })

    // Log SSO login (fire-and-forget)
    prisma.auditLog.create({
      data: {
        action: 'SSO_LOGIN',
        entity: 'StaffUser',
        entityId: staffUser.id,
        details: `Azure AD SSO login: ${email}`,
      },
    }).catch(() => {})

    return response
  } catch (err) {
    console.error('Azure callback error:', err)
    return NextResponse.redirect(new URL('/login?error=sso_failed', req.url))
  }
}
