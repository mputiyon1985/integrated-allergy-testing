/**
 * @file /api/practices/[id]/insurances — Practice-level insurance payer preferences
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { createId } from '@paralleldrive/cuid2'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: practiceId } = await params

    // Raw query since PracticeInsurance has no Prisma relations to InsuranceCompany
    const rows = await prisma.$queryRaw<
      {
        pi_id: string
        pi_practiceId: string
        pi_insuranceId: string
        pi_sortOrder: number
        ic_id: string
        ic_name: string
        ic_type: string
        ic_payerId: string | null
      }[]
    >`
      SELECT
        pi.id         AS pi_id,
        pi.practiceId AS pi_practiceId,
        pi.insuranceId AS pi_insuranceId,
        pi.sortOrder  AS pi_sortOrder,
        ic.id         AS ic_id,
        ic.name       AS ic_name,
        ic.type       AS ic_type,
        ic.payerId    AS ic_payerId
      FROM PracticeInsurance pi
      JOIN InsuranceCompany ic ON ic.id = pi.insuranceId
      WHERE pi.practiceId = ${practiceId}
      ORDER BY pi.sortOrder ASC, ic.name ASC
    `

    const insurances = rows.map(r => ({
      id: r.pi_id,
      practiceId: r.pi_practiceId,
      insuranceId: r.pi_insuranceId,
      sortOrder: r.pi_sortOrder,
      insurance: {
        id: r.ic_id,
        name: r.ic_name,
        type: r.ic_type,
        payerId: r.ic_payerId,
      },
    }))

    return NextResponse.json({ insurances })
  } catch (err) {
    console.error('[PracticeInsurances] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch practice insurances' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: practiceId } = await params
    const body = await req.json() as { insuranceId?: string }
    const { insuranceId } = body

    if (!insuranceId) {
      return NextResponse.json({ error: 'insuranceId is required' }, { status: 400 })
    }

    await prisma.$executeRaw`
      INSERT OR IGNORE INTO PracticeInsurance (id, practiceId, insuranceId, sortOrder, createdAt)
      SELECT ${`pi-${createId()}`}, ${practiceId}, ${insuranceId},
             COALESCE((SELECT sortOrder FROM InsuranceCompany WHERE id = ${insuranceId}), 0),
             CURRENT_TIMESTAMP
    `

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PracticeInsurances] POST error:', err)
    return NextResponse.json({ error: 'Failed to add insurance to practice' }, { status: 500 })
  }
}
