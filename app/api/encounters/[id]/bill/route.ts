/**
 * @file /api/encounters/[id]/bill — Mark encounter as billed
 * POST — admin or billing role only
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, 'billing_rules_manage')
  if (denied) return denied

  try {
    const { id } = await params

    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, status, patientId FROM Encounter WHERE id=? AND deletedAt IS NULL LIMIT 1`,
      id
    )
    const existing = existingRows[0] ?? null
    if (!existing) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
    if (existing.status !== 'signed') {
      return NextResponse.json({ error: 'Encounter must be signed before billing' }, { status: 409 })
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "Encounter" SET status='billed', billedAt=CURRENT_TIMESTAMP, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      id
    )

    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "Encounter" WHERE id=?`, id
    )
    const encounter = rows[0] ?? null

    prisma.auditLog.create({
      data: {
        action: 'ENCOUNTER_BILLED',
        entity: 'Encounter',
        entityId: id,
        patientId: existing.patientId as string,
        details: 'Encounter marked as billed',
      }
    }).catch((e: unknown) => console.error('[audit]', e))

    return NextResponse.json({ encounter }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('[bill]', err)
    return NextResponse.json({ error: 'Failed to mark as billed' }, { status: 500 })
  }
}
