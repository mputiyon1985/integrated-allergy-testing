import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'
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
    if (!encounter) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(encounter, { headers: HIPAA_HEADERS })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, 'encounters_edit')
  if (denied) return denied
  try {
    const { id } = await params
    const body = await req.json() as Record<string, unknown>

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

    prisma.auditLog.create({ data: { action: 'ENCOUNTER_UPDATED', entity: 'Encounter', entityId: id, patientId: encounter?.patientId as string ?? '' }}).catch(()=>{})
    return NextResponse.json({ encounter }, { headers: HIPAA_HEADERS })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
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
    prisma.auditLog.create({ data: { action: 'ENCOUNTER_DELETED', entity: 'Encounter', entityId: id, patientId }}).catch(()=>{})
    return NextResponse.json({ ok: true })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
