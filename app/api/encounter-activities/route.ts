/**
 * @file /api/encounter-activities — Create encounter activity for a patient
 * @description
 *   POST — Accepts activityType (or type), encounterId (optional), soapXxx fields.
 *          If encounterId provided, uses it directly. Otherwise finds/creates today's open encounter.
 *          Fire-and-forget integration point from kiosk, consent, waiting-room, and manual flows.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const denied = await requirePermission(request, 'encounters_create')
  if (denied) return denied
  try {
    const body = await request.json() as Record<string, unknown>

    // Support both activityType (frontend) and type (DB/legacy)
    const actType = (body.activityType ?? body.type) as string | undefined
    if (!body.patientId || !actType) {
      return NextResponse.json({ error: 'patientId and activityType (or type) are required' }, { status: 400 })
    }

    const patientId        = String(body.patientId)
    const type             = String(actType)
    const performedBy      = body.performedBy      ? String(body.performedBy).slice(0, 200)  : null
    const notes            = body.notes            ? String(body.notes).slice(0, 2000)        : null
    // Support soapXxx (frontend) and subjectiveNotes/objectiveNotes/assessment/plan (DB column names)
    const subjectiveNotes  = (body.soapSubjective  ?? body.subjectiveNotes)  ? String(body.soapSubjective  ?? body.subjectiveNotes).slice(0, 2000)  : null
    const objectiveNotes   = (body.soapObjective   ?? body.objectiveNotes)   ? String(body.soapObjective   ?? body.objectiveNotes).slice(0, 2000)   : null
    const assessment       = (body.soapAssessment  ?? body.assessment)       ? String(body.soapAssessment  ?? body.assessment).slice(0, 2000)       : null
    const plan             = (body.soapPlan        ?? body.plan)             ? String(body.soapPlan        ?? body.plan).slice(0, 2000)             : null
    const linkedTestResultId   = body.linkedTestResultId   ? String(body.linkedTestResultId)   : null
    const linkedConsentId      = body.linkedConsentId      ? String(body.linkedConsentId)      : null
    const linkedAppointmentId  = body.linkedAppointmentId  ? String(body.linkedAppointmentId)  : null

    // Resolve encounterId: use provided one, or find/create today's open encounter
    let encounterId: string

    if (body.encounterId) {
      encounterId = String(body.encounterId)
      // Verify it exists
      const check = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM Encounter WHERE id=? AND deletedAt IS NULL LIMIT 1`,
        encounterId
      )
      if (!check.length) {
        return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
      }
    } else {
      // Find today's open encounter or create one
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

      const encounterRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM Encounter
         WHERE patientId=? AND deletedAt IS NULL AND status='open'
         AND encounterDate >= ? AND encounterDate < ?
         ORDER BY encounterDate DESC LIMIT 1`,
        patientId, today.toISOString(), tomorrow.toISOString()
      )

      if (encounterRows.length > 0) {
        encounterId = encounterRows[0].id
      } else {
        encounterId = randomUUID()
        const chiefComplaint = `Visit — ${new Date().toLocaleDateString()}`
        await prisma.$executeRawUnsafe(
          `INSERT INTO Encounter
            (id, patientId, chiefComplaint, status, encounterDate, createdAt, updatedAt)
           VALUES (?,?,?,'open',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
          encounterId, patientId, chiefComplaint
        )
      }
    }

    const activityId = randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO EncounterActivity
        (id, encounterId, patientId, type, timestamp, performedBy, notes,
         subjectiveNotes, objectiveNotes, assessment, plan,
         linkedTestResultId, linkedConsentId, linkedAppointmentId,
         createdAt, updatedAt)
       VALUES (?,?,?,?,CURRENT_TIMESTAMP,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      activityId, encounterId, patientId, type,
      performedBy, notes, subjectiveNotes, objectiveNotes, assessment, plan,
      linkedTestResultId, linkedConsentId, linkedAppointmentId
    )

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, encounterId, patientId,
              type as activityType,
              timestamp as performedAt,
              performedBy, notes,
              subjectiveNotes as soapSubjective,
              objectiveNotes  as soapObjective,
              assessment      as soapAssessment,
              plan            as soapPlan,
              linkedTestResultId, linkedConsentId, linkedAppointmentId,
              createdAt, updatedAt
       FROM EncounterActivity WHERE id=? LIMIT 1`,
      activityId
    )
    const activity = rows[0] ?? { id: activityId }

    return NextResponse.json({ ok: true, activity, encounterId }, { status: 201, headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('POST /api/encounter-activities error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
