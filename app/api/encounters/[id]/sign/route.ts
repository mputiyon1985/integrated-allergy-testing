/**
 * @file /api/encounters/[id]/sign — MD signs and locks an encounter
 * POST — requires encounters_edit permission (provider or admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, 'encounters_edit')
  if (denied) return denied

  try {
    const { id } = await params
    const body = await req.json() as { mdName?: string; attestation?: string; diagnosisCode?: string }

    if (!body.mdName) {
      return NextResponse.json({ error: 'mdName is required' }, { status: 400 })
    }

    // Verify encounter exists and is in awaiting_md status
    const existing = await prisma.encounter.findFirst({ where: { id, deletedAt: null } })
    if (!existing) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
    if (existing.status === 'signed' || existing.status === 'billed') {
      return NextResponse.json({ error: 'Encounter already signed or billed' }, { status: 409 })
    }

    const attestation = body.attestation ??
      `I have personally reviewed and approve the clinical documentation for this encounter. ${body.mdName} ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`

    await prisma.$executeRawUnsafe(
      `UPDATE "Encounter" SET status='signed', signedBy=?, signedAt=CURRENT_TIMESTAMP, mdAttestation=?, diagnosisCode=COALESCE(?, diagnosisCode), updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      body.mdName, attestation, body.diagnosisCode ?? null, id
    )

    // Fetch updated encounter
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "Encounter" WHERE id=?`, id
    )
    const encounter = rows[0] ?? null

    prisma.auditLog.create({
      data: {
        action: 'ENCOUNTER_SIGNED',
        entity: 'Encounter',
        entityId: id,
        patientId: existing.patientId,
        details: `Signed by MD: ${body.mdName}`,
      }
    }).catch(() => {})

    return NextResponse.json({ encounter }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('[sign]', err)
    return NextResponse.json({ error: 'Failed to sign encounter' }, { status: 500 })
  }
}
