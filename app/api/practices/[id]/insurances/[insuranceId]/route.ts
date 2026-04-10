/**
 * @file /api/practices/[id]/insurances/[insuranceId] — Remove a payer from a practice
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; insuranceId: string }> }
) {
  const denied = await requirePermission(req, 'practices_manage')
  if (denied) return denied
  try {
    const { id: practiceId, insuranceId } = await params

    await prisma.$executeRaw`
      DELETE FROM PracticeInsurance
      WHERE practiceId = ${practiceId} AND insuranceId = ${insuranceId}
    `

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PracticeInsurances] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to remove insurance from practice' }, { status: 500 })
  }
}
