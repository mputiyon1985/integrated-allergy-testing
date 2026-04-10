/**
 * @file /api/encounters/auto-link — Auto-link an activity to today's open encounter
 * POST — finds today's open encounter for a patient and adds an activity
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      patientId?: string
      activityType?: string
      notes?: string
      performedBy?: string
    }

    if (!body.patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)

    // Find today's open or awaiting_md encounter
    const encounters = await prisma.$queryRawUnsafe<{ id: string; patientId: string }[]>(
      `SELECT id, patientId FROM "Encounter"
       WHERE patientId=?
         AND status IN ('open', 'awaiting_md')
         AND encounterDate >= ?
         AND encounterDate <= ?
         AND deletedAt IS NULL
       ORDER BY encounterDate DESC
       LIMIT 1`,
      body.patientId,
      startOfDay.toISOString(),
      endOfDay.toISOString()
    )

    if (!encounters.length) {
      return NextResponse.json({ linked: false, reason: 'No open encounter found for today' }, { headers: HIPAA_HEADERS })
    }

    const encounter = encounters[0]
    const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    await prisma.$executeRawUnsafe(
      `INSERT INTO "EncounterActivity" (id, encounterId, patientId, type, performedBy, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      activityId,
      encounter.id,
      body.patientId,
      body.activityType ?? 'allergy_test',
      body.performedBy ?? null,
      body.notes ?? null
    )

    return NextResponse.json({
      linked: true,
      encounterId: encounter.id,
      activityId,
    }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('[auto-link]', err)
    return NextResponse.json({ error: 'Failed to auto-link encounter' }, { status: 500 })
  }
}
