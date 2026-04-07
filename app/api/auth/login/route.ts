import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { signSession, setSessionCookie } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_MAX = 5

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; password?: string }
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Rate limit: count recent failed attempts for this email
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
    const failedAttempts = await prisma.auditLog.count({
      where: {
        action: 'LOGIN_FAILED',
        entity: 'StaffUser',
        details: email,
        createdAt: { gte: windowStart },
      },
    })

    if (failedAttempts >= RATE_LIMIT_MAX) {
      await prisma.auditLog.create({
        data: {
          action: 'LOGIN_RATE_LIMITED',
          entity: 'StaffUser',
          details: email,
        },
      })
      return NextResponse.json(
        { error: 'Too many failed attempts. Try again in 15 minutes.' },
        { status: 429 }
      )
    }

    // Find staff user
    const user = await prisma.staffUser.findUnique({ where: { email } })

    if (!user || !user.active) {
      await prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          entity: 'StaffUser',
          details: email,
        },
      })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash)

    if (!valid) {
      await prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          entity: 'StaffUser',
          entityId: user.id,
          details: email,
        },
      })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Success: sign JWT and set cookie
    const token = await signSession({ userId: user.id, email: user.email, role: user.role })
    await setSessionCookie(token)

    await prisma.auditLog.create({
      data: {
        action: 'LOGIN_SUCCESS',
        entity: 'StaffUser',
        entityId: user.id,
        details: email,
      },
    })

    return NextResponse.json({ ok: true, role: user.role, name: user.name })
  } catch (error) {
    console.error('POST /api/auth/login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
