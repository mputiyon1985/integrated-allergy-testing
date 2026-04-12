/**
 * @file /api/auth/switch-role — Demo role switcher
 * @description Allows admin users to impersonate demo roles and return to admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifySession, signSession } from '@/lib/auth/session'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { targetEmail?: string; password?: string; returnToAdmin?: boolean }

    // Return to admin: verify the stored admin session
    if (body.returnToAdmin) {
      const session = await verifySession(req)
      if (!session) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

      // Look up the actual admin user
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, email, name, role FROM StaffUser WHERE email=? LIMIT 1`,
        'mputiyon@tipinc.ai'
      )
      if (!rows[0]) return NextResponse.json({ error: 'Admin not found' }, { status: 404 })

      const token = await signSession({
        id: rows[0].id as string,
        email: rows[0].email as string,
        name: rows[0].name as string,
        role: rows[0].role as string,
      })

      const res = NextResponse.json({ ok: true })
      res.cookies.set('iat_session', token, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/',
      })
      return res
    }

    // Switch to demo role
    const { targetEmail, password } = body
    if (!targetEmail || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email, name, role, passwordHash, active FROM StaffUser WHERE email=? LIMIT 1`,
      targetEmail
    )
    const user = rows[0]
    if (!user || !user.active) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const valid = await bcrypt.compare(password, user.passwordHash as string)
    if (!valid) return NextResponse.json({ error: 'Invalid password' }, { status: 401 })

    const token = await signSession({
      id: user.id as string,
      email: user.email as string,
      name: user.name as string,
      role: user.role as string,
    })

    const res = NextResponse.json({ ok: true, role: user.role, name: user.name })
    res.cookies.set('iat_session', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/',
    })
    return res
  } catch (err) {
    console.error('switch-role error:', err)
    return NextResponse.json({ error: 'Switch failed' }, { status: 500 })
  }
}
