/**
 * @file /api/encounters/[id]/activities — List and add activities for a specific encounter
 * @description
 *   GET  — List all activities for an encounter (excludes soft-deleted).
 *   POST — Add an activity to an encounter.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
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

    const encounter = await prisma.encounter.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, patientId: true },
    })
    if (!encounter) {
      return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
    }

    const activities = await prisma.encounterActivity.findMany({
      where: { encounterId: id, deletedAt: null },
      orderBy: { timestamp: 'asc' },
    })

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

    const encounter = await prisma.encounter.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, patientId: true },
    })
    if (!encounter) {
      return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
    }

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

    const activity = await prisma.encounterActivity.create({
      data: {
        encounterId: id,
        patientId: encounter.patientId,
        type,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        performedBy: performedBy ?? null,
        notes: notes ?? null,
        subjectiveNotes: subjectiveNotes ?? null,
        objectiveNotes: objectiveNotes ?? null,
        assessment: assessment ?? null,
        plan: plan ?? null,
        linkedTestResultId: linkedTestResultId ?? null,
        linkedConsentId: linkedConsentId ?? null,
        linkedAppointmentId: linkedAppointmentId ?? null,
      },
    })

    return NextResponse.json(activity, { status: 201, headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('POST /api/encounters/[id]/activities error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
