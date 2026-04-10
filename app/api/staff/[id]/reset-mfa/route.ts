/**
 * @file /api/staff/[id]/reset-mfa — Admin MFA reset
 * @description Allows an admin to reset MFA for a staff user, forcing them to re-enroll
 *              on next login.
 * @security Requires authenticated session with admin role
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifySession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
  }

  const { id } = await params

  try {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, email FROM StaffUser WHERE id=? LIMIT 1`,
      id
    )
    const user = rows[0] ? {
      id: rows[0].id as string,
      email: rows[0].email as string,
    } : null

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.$executeRawUnsafe(
      `UPDATE StaffUser SET mfaEnabled=0, mfaSecret=NULL, tempToken=NULL, tempTokenExpiry=NULL, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      id
    )

    await prisma.auditLog.create({
      data: {
        action: 'MFA_RESET',
        entity: 'StaffUser',
        entityId: id,
        details: `MFA reset by admin ${session.email as string} for user ${user.email}`,
      },
    })

    return NextResponse.json({ success: true, message: `MFA reset for ${user.email}` })
  } catch (error) {
    console.error('POST /api/staff/[id]/reset-mfa error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
