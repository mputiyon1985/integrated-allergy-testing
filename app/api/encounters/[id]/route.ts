import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { verifySession } from '@/lib/auth/session'
import { requirePermission } from '@/lib/api-permissions'

const UpdateEncounterSchema = z.object({
  chiefComplaint: z.string().max(500).optional(),
  subjectiveNotes: z.string().max(5000).optional(),
  objectiveNotes: z.string().max(5000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
  status: z.string().max(50).optional(),
  doctorId: z.string().max(100).optional().nullable(),
  doctorName: z.string().max(200).optional().nullable(),
  nurseId: z.string().max(100).optional().nullable(),
  nurseName: z.string().max(200).optional().nullable(),
  appointmentId: z.string().max(100).optional().nullable(),
  followUpDays: z.number().int().min(0).max(365).optional().nullable(),
  encounterDate: z.string().optional(),
})
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, patientId, encounterDate, doctorId, doctorName, nurseId, nurseName, appointmentId,
              chiefComplaint, subjectiveNotes, objectiveNotes, assessment, plan, followUpDays,
              status, createdBy, createdAt, updatedAt, deletedAt, linkedAppointmentId, locationId,
              waitMinutes, inServiceMinutes, waitingRoomId, signedBy, signedAt, billedAt,
              mdAttestation, cptSummary, diagnosisCode
       FROM Encounter WHERE id=? AND deletedAt IS NULL LIMIT 1`,
      id
    )
    const encounter = rows[0] ?? null
    if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })

    // Fetch activities for this encounter
    const activities = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
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
       FROM EncounterActivity
       WHERE encounterId=? AND deletedAt IS NULL
       ORDER BY timestamp ASC`,
      id
    )
    encounter.activities = activities

    // HIPAA: audit every encounter PHI read
    const session = await verifySession(_req)
    const sessionName = String(session?.name ?? 'unknown')
    const sessionRole = String(session?.role ?? 'unknown')
    prisma.auditLog.create({ data: {
      action: 'ENCOUNTER_VIEWED',
      entity: 'Encounter',
      entityId: id,
      patientId: (encounter.patientId as string) ?? '',
      performedBy: sessionName,
      details: `Encounter ${id.slice(0,8)} accessed by ${sessionName} (${sessionRole})`,
    }}).catch((e: unknown) => console.error('[audit]', e))

    return NextResponse.json(encounter, { headers: HIPAA_HEADERS })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed to fetch encounter' }, { status: 500 }) }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, 'encounters_edit')
  if (denied) return denied
  try {
    const { id } = await params
    const rawBody = await req.json()
    const parsed = UpdateEncounterSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }
    const body = parsed.data as Record<string, unknown>

    const setClauses: string[] = []
    const values: unknown[] = []

    const textFields = ['chiefComplaint','subjectiveNotes','objectiveNotes','assessment','plan','status','doctorId','doctorName','nurseId','nurseName','appointmentId']
    for (const f of textFields) {
      if (body[f] !== undefined) {
        setClauses.push(`${f}=?`)
        values.push(body[f])
      }
    }
    if (body.followUpDays !== undefined) {
      setClauses.push('followUpDays=?')
      values.push(body.followUpDays !== null ? Number(body.followUpDays) : null)
    }
    if (body.encounterDate) {
      setClauses.push('encounterDate=?')
      values.push(String(body.encounterDate))
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    setClauses.push('updatedAt=CURRENT_TIMESTAMP')
    values.push(id)

    await prisma.$executeRawUnsafe(
      `UPDATE Encounter SET ${setClauses.join(', ')} WHERE id=?`,
      ...values
    )

    const updatedRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, patientId, encounterDate, doctorId, doctorName, nurseId, nurseName, appointmentId,
              chiefComplaint, subjectiveNotes, objectiveNotes, assessment, plan, followUpDays,
              status, createdBy, createdAt, updatedAt, locationId, waitMinutes, inServiceMinutes,
              signedBy, cptSummary, diagnosisCode
       FROM Encounter WHERE id=? LIMIT 1`,
      id
    )
    const encounter = updatedRows[0] ?? null

    prisma.auditLog.create({ data: { action: 'ENCOUNTER_UPDATED', entity: 'Encounter', entityId: id, patientId: encounter?.patientId as string ?? '' }}).catch((e: unknown) => console.error('[audit]', e))
    return NextResponse.json({ encounter }, { headers: HIPAA_HEADERS })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed to update encounter' }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Get patientId before delete for audit log
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT patientId FROM Encounter WHERE id=? LIMIT 1`, id
    )
    const patientId = (rows[0]?.patientId as string) ?? ''
    await prisma.$executeRawUnsafe(
      `UPDATE Encounter SET deletedAt=CURRENT_TIMESTAMP, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      id
    )
    prisma.auditLog.create({ data: { action: 'ENCOUNTER_DELETED', entity: 'Encounter', entityId: id, patientId }}).catch((e: unknown) => console.error('[audit]', e))
    return NextResponse.json({ ok: true })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed to delete encounter' }, { status: 500 }) }
}
