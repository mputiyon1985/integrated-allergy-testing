/**
 * @file /api/encounters/[id]/activities — List and add activities for a specific encounter
 * @description
 *   GET  — List all activities for an encounter (excludes soft-deleted).
 *   POST — Add an activity to an encounter.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const createActivitySchema = z.object({
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
  timestamp: z.string().datetime().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const encounterRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, patientId FROM Encounter WHERE id=? AND deletedAt IS NULL LIMIT 1`,
      id
    )
    if (!encounterRows.length) {
      return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
    }

    const activities = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, encounterId, patientId, type, timestamp, performedBy, notes,
              subjectiveNotes, objectiveNotes, assessment, plan,
              linkedTestResultId, linkedConsentId, linkedAppointmentId, createdAt, updatedAt
       FROM EncounterActivity
       WHERE encounterId=? AND deletedAt IS NULL
       ORDER BY timestamp ASC`,
      id
    )

    return NextResponse.json(activities, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('GET /api/encounters/[id]/activities error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(request, 'encounters_create')
  if (denied) return denied
  try {
    const { id } = await params

    const encounterRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, patientId FROM Encounter WHERE id=? AND deletedAt IS NULL LIMIT 1`,
      id
    )
    if (!encounterRows.length) {
      return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
    }
    const encounter = encounterRows[0]

    const body = await request.json()
    const result = createActivitySchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const {
      type, performedBy, notes, subjectiveNotes, objectiveNotes,
      assessment, plan, linkedTestResultId, linkedConsentId,
      linkedAppointmentId, timestamp,
    } = result.data

    const activityId = randomUUID()
    const ts = timestamp ? timestamp : new Date().toISOString()

    await prisma.$executeRawUnsafe(
      `INSERT INTO EncounterActivity
        (id, encounterId, patientId, type, timestamp, performedBy, notes,
         subjectiveNotes, objectiveNotes, assessment, plan,
         linkedTestResultId, linkedConsentId, linkedAppointmentId,
         createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      activityId,
      id,
      encounter.patientId as string,
      type,
      ts,
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

    return NextResponse.json(activity, { status: 201, headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('POST /api/encounters/[id]/activities error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
