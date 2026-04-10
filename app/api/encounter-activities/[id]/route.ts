/**
 * @file /api/encounter-activities/[id] — Get, update, or soft-delete an encounter activity
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

function activitySelect(id: string) {
  return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id, encounterId, patientId,
            type            as activityType,
            timestamp       as performedAt,
            performedBy, notes,
            subjectiveNotes as soapSubjective,
            objectiveNotes  as soapObjective,
            assessment      as soapAssessment,
            plan            as soapPlan,
            linkedTestResultId, linkedConsentId, linkedAppointmentId,
            createdAt, updatedAt
     FROM EncounterActivity WHERE id=? AND deletedAt IS NULL LIMIT 1`,
    id
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const rows = await activitySelect(id)
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0], { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('GET /api/encounter-activities/[id] error:', err)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(req, 'encounters_edit')
  if (denied) return denied

  const { id } = await params
  try {
    const body = await req.json() as Record<string, unknown>
    const setClauses: string[] = []
    const values: unknown[] = []

    // Support activityType (frontend) → type (DB column)
    const actType = body.activityType ?? body.type
    if (actType !== undefined) { setClauses.push('type=?'); values.push(String(actType)) }

    const textMap: [string, string][] = [
      ['performedBy', 'performedBy'],
      ['notes', 'notes'],
      // Support both soapXxx (frontend) and raw DB column names
      ['soapSubjective', 'subjectiveNotes'],
      ['subjectiveNotes', 'subjectiveNotes'],
      ['soapObjective', 'objectiveNotes'],
      ['objectiveNotes', 'objectiveNotes'],
      ['soapAssessment', 'assessment'],
      ['assessment', 'assessment'],
      ['soapPlan', 'plan'],
      ['plan', 'plan'],
    ]
    const seen = new Set<string>()
    for (const [bodyKey, dbCol] of textMap) {
      if (body[bodyKey] !== undefined && !seen.has(dbCol)) {
        setClauses.push(`${dbCol}=?`)
        values.push(body[bodyKey] !== null ? String(body[bodyKey]).slice(0, 2000) : null)
        seen.add(dbCol)
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    setClauses.push('updatedAt=CURRENT_TIMESTAMP')
    values.push(id)

    await prisma.$executeRawUnsafe(
      `UPDATE EncounterActivity SET ${setClauses.join(', ')} WHERE id=?`,
      ...values
    )

    const rows = await activitySelect(id)
    const activity = rows[0] ?? null
    return NextResponse.json({ activity }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('PUT /api/encounter-activities/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(req, 'encounters_edit')
  if (denied) return denied

  const { id } = await params
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE EncounterActivity SET deletedAt=CURRENT_TIMESTAMP, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      id
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/encounter-activities/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 })
  }
}
