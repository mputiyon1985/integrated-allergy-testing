/**
 * @file /api/encounter-activities — Create encounter activity for a patient
 * @description
 *   POST — Finds or creates today's open encounter for the patient, then adds the activity.
 *          Used as a fire-and-forget integration point from kiosk, consent, test-result,
 *          and appointment flows.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  patientId: z.string().min(1),
  type: z.string().min(1).max(100),
  performedBy: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  subjectiveNotes: z.string().max(2000).optional(),
  objectiveNotes: z.string().max(2000).optional(),
  assessment: z.string().max(2000).optional(),
  plan: z.string().max(2000).optional(),
  linkedTestResultId: z.string().optional(),
  linkedConsentId: z.string().optional(),
  linkedAppointmentId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const denied = await requirePermission(request, 'encounters_create')
  if (denied) return denied
  try {
    const body = await request.json()
    const result = createSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const {
      patientId, type, performedBy, notes, subjectiveNotes, objectiveNotes,
      assessment, plan, linkedTestResultId, linkedConsentId, linkedAppointmentId,
    } = result.data

    // Find today's open encounter or create one
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayISO = today.toISOString()
    const tomorrowISO = tomorrow.toISOString()

    let encounterId: string

    const encounterRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id FROM Encounter
       WHERE patientId=? AND deletedAt IS NULL AND status='open'
       AND encounterDate >= ? AND encounterDate < ?
       ORDER BY encounterDate DESC LIMIT 1`,
      patientId, todayISO, tomorrowISO
    )

    if (encounterRows.length > 0) {
      encounterId = encounterRows[0].id as string
    } else {
      // Create new encounter
      encounterId = randomUUID()
      const chiefComplaint = `Visit - ${new Date().toLocaleDateString()}`
      await prisma.$executeRawUnsafe(
        `INSERT INTO Encounter
          (id, patientId, chiefComplaint, status, encounterDate, createdAt, updatedAt)
         VALUES (?,?,?,'open',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        encounterId, patientId, chiefComplaint
      )
    }

    const activityId = randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO EncounterActivity
        (id, encounterId, patientId, type, timestamp, performedBy, notes,
         subjectiveNotes, objectiveNotes, assessment, plan,
         linkedTestResultId, linkedConsentId, linkedAppointmentId,
         createdAt, updatedAt)
       VALUES (?,?,?,?,CURRENT_TIMESTAMP,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      activityId,
      encounterId,
      patientId,
      type,
      performedBy ?? null,
      notes ?? null,
      subjectiveNotes ?? null,
      objectiveNotes ?? null,
      assessment ?? null,
      plan ?? null,
      linkedTestResultId ?? null,
      linkedConsentId ?? null,
      linkedAppointmentId ?? null
    )

    const activityRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM EncounterActivity WHERE id=? LIMIT 1`,
      activityId
    )
    const activity = activityRows[0] ?? { id: activityId }

    return NextResponse.json({ ok: true, activity, encounterId }, { status: 201, headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('POST /api/encounter-activities error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
