/**
 * @file /api/staff/[id]/reset-password — Admin password reset
 * @description Allows an admin to reset a staff user's password. Hashes server-side.
 * @security Requires authenticated session with admin role
 */
import { NextRequest, NextResponse } from 'next/server'
import { validatePassword } from '@/lib/password-policy'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { verifySession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json() as { password?: string }
    const { password } = body

    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email FROM StaffUser WHERE id=? LIMIT 1`,
      id
    )
    if (!existingRows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) return NextResponse.json({ error: pwCheck.errors.join('. ') }, { status: 400 })
    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.$executeRawUnsafe(
      `UPDATE StaffUser SET passwordHash=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      passwordHash, id
    )

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_PASSWORD_RESET',
        entity: 'StaffUser',
        entityId: id,
        details: `Password reset by admin ${session.email as string}`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/staff/[id]/reset-password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
