/**
 * @file /api/encounter-activities — Create encounter activity for a patient
 * @description
 *   POST — Finds or creates today's open encounter for the patient, then adds the activity.
 *          Used as a fire-and-forget integration point from kiosk, consent, test-result,
 *          and appointment flows.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

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

    let encounter = await prisma.encounter.findFirst({
      where: {
        patientId,
        deletedAt: null,
        status: 'open',
        encounterDate: { gte: today, lt: tomorrow },
      },
    })

    if (!encounter) {
      encounter = await prisma.encounter.create({
        data: {
          patientId,
          status: 'open',
          chiefComplaint: `Visit - ${new Date().toLocaleDateString()}`,
        },
      })
    }

    const activity = await prisma.encounterActivity.create({
      data: {
        encounterId: encounter.id,
        patientId,
        type,
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

    return NextResponse.json({ ok: true, activity, encounterId: encounter.id }, { status: 201, headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('POST /api/encounter-activities error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
