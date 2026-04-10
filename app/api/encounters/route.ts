import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  const locationId = searchParams.get('locationId')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  try {
    let sql = `SELECT id, patientId, encounterDate, doctorId, doctorName, nurseId, nurseName,
                      chiefComplaint, status, waitMinutes, inServiceMinutes, locationId,
                      signedBy, signedAt, billedAt, cptSummary, diagnosisCode, createdAt
               FROM Encounter
               WHERE deletedAt IS NULL`
    const values: unknown[] = []

    if (patientId) {
      sql += ' AND patientId=?'
      values.push(patientId)
    }
    if (locationId) {
      sql += ' AND locationId=?'
      values.push(locationId)
    }
    sql += ' ORDER BY encounterDate DESC'
    sql += ` LIMIT ${limit}`

    const encounters = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...values)
    return NextResponse.json({ encounters }, { headers: HIPAA_HEADERS })
  } catch (err) { console.error(err); return NextResponse.json({ encounters: [] }) }
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, 'encounters_create')
  if (denied) return denied
  try {
    const body = await req.json() as Record<string, unknown>
    if (!body.patientId || !body.chiefComplaint) return NextResponse.json({ error: 'patientId and chiefComplaint required' }, { status: 400 })

    const id = randomUUID()
    const patientId = String(body.patientId)
    const chiefComplaint = String(body.chiefComplaint)
    const encounterDate = body.encounterDate ? String(body.encounterDate) : new Date().toISOString()
    const doctorId = body.doctorId ? String(body.doctorId) : null
    const doctorName = body.doctorName ? String(body.doctorName) : null
    const nurseId = body.nurseId ? String(body.nurseId) : null
    const nurseName = body.nurseName ? String(body.nurseName) : null
    const appointmentId = body.appointmentId ? String(body.appointmentId) : null
    const subjectiveNotes = body.subjectiveNotes ? String(body.subjectiveNotes) : null
    const objectiveNotes = body.objectiveNotes ? String(body.objectiveNotes) : null
    const assessment = body.assessment ? String(body.assessment) : null
    const plan = body.plan ? String(body.plan) : null
    const followUpDays = body.followUpDays ? Number(body.followUpDays) : null
    const status = body.status ? String(body.status) : 'open'
    const locationId = body.locationId ? String(body.locationId) : null
    const createdBy = body.createdBy ? String(body.createdBy) : null

    await prisma.$executeRawUnsafe(
      `INSERT INTO Encounter
        (id, patientId, chiefComplaint, encounterDate, doctorId, doctorName, nurseId, nurseName,
         appointmentId, subjectiveNotes, objectiveNotes, assessment, plan, followUpDays,
         status, locationId, createdBy, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      id, patientId, chiefComplaint, encounterDate, doctorId, doctorName, nurseId, nurseName,
      appointmentId, subjectiveNotes, objectiveNotes, assessment, plan, followUpDays,
      status, locationId, createdBy
    )

    prisma.auditLog.create({ data: { action: 'ENCOUNTER_CREATED', entity: 'Encounter', entityId: id, patientId, details: `Chief complaint: ${chiefComplaint}` }}).catch(()=>{})
    return NextResponse.json({ encounter: { id, patientId, chiefComplaint, status } }, { status: 201, headers: HIPAA_HEADERS })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed to create encounter' }, { status: 500 }) }
}
