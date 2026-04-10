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

    // Find or create staff user using raw SQL
    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, active, mfaEnabled, defaultLocationId FROM StaffUser WHERE email=? LIMIT 1`,
      email
    )
    let staffUser = existingRows[0] ? {
      id: existingRows[0].id as string,
      email: existingRows[0].email as string,
      name: existingRows[0].name as string,
      role: existingRows[0].role as string,
      active: Boolean(existingRows[0].active),
      defaultLocationId: existingRows[0].defaultLocationId as string | null,
    } : null

    if (!staffUser) {
      const newId = crypto.randomUUID()
      const newName = session.user.name || email.split('@')[0]
      await prisma.$executeRawUnsafe(
        `INSERT INTO StaffUser (id, email, passwordHash, name, role, active, mfaEnabled, updatedAt) VALUES (?,?,?,?,?,1,1,CURRENT_TIMESTAMP)`,
        newId, email, 'sso-no-password', newName, 'staff'
      )
      staffUser = {
        id: newId,
        email,
        name: newName,
        role: 'staff',
        active: true,
        defaultLocationId: null,
      }
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
      defaultLocationId: staffUser.defaultLocationId ?? 'loc-iat-001',
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
        performedBy: staffUser.name,
        details: `Azure AD SSO login: ${email}`,
      },
    }).catch(() => {})

    return response
  } catch (err) {
    console.error('Azure callback error:', err)
    return NextResponse.redirect(new URL('/login?error=sso_failed', req.url))
  }
}
