/**
 * @file /api/waiting-room — Waiting room management
 * @description
 *   GET  — Returns all active waiting-room entries (status: waiting | in-service).
 *   POST — Adds a patient to the waiting room after kiosk check-in completes.
 *   Staff-facing (GET) and kiosk-facing (POST) endpoint.
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { verifySession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Staff-only: requires authenticated session
  const session = await verifySession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: HIPAA_HEADERS })
  }

  try {
    const entries = await prisma.waitingRoom.findMany({
      where: { status: { in: ['waiting', 'in-service'] } },
      orderBy: { checkedInAt: 'asc' },
    })
    return NextResponse.json({ entries }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('GET /api/waiting-room error:', err)
    return NextResponse.json({ entries: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { patientId?: string; patientName?: string; notes?: string; videosWatched?: number }

    // Validate required fields
    if (!body.patientId || !body.patientName) {
      return NextResponse.json({ error: 'patientId and patientName are required' }, { status: 400, headers: HIPAA_HEADERS })
    }

    // Validate that the patientId actually exists in the database to prevent spoofing
    const patient = await prisma.patient.findFirst({
      where: { id: body.patientId, deletedAt: null },
      select: { id: true, name: true },
    })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404, headers: HIPAA_HEADERS })
    }

    // Dedup: if patient already has an active (waiting/in-service) entry, return it
    const existing = await prisma.waitingRoom.findFirst({
      where: { patientId: patient.id, status: { in: ['waiting', 'in-service'] } },
    })
    if (existing) {
      return NextResponse.json({ entry: existing, deduplicated: true }, { headers: HIPAA_HEADERS })
    }

    // Sanitize inputs and use verified name from DB, not user-provided name
    const videosWatched = typeof body.videosWatched === 'number' && body.videosWatched >= 0
      ? Math.floor(body.videosWatched)
      : 0

    const entry = await prisma.waitingRoom.create({
      data: {
        patientId: patient.id,
        patientName: patient.name,   // Always use DB name, not user-supplied name
        notes: body.notes ? String(body.notes).slice(0, 500) : undefined,
        videosWatched,
        status: 'waiting',
      },
    })

    // Auto-create kiosk_checkin encounter activity
    fetch(`${process.env.NEXTAUTH_URL || 'https://integrated-allergy-testing.vercel.app'}/api/encounter-activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: patient.id,
        type: 'kiosk_checkin',
        notes: `Patient checked in via kiosk. Videos watched: ${body.videosWatched ?? 0}`,
        performedBy: 'Patient (Kiosk)',
      }),
    }).catch(() => {})

    return NextResponse.json({ entry }, { status: 201, headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('POST /api/waiting-room error:', err)
    return NextResponse.json({ error: 'Failed to add to waiting room' }, { status: 500 })
  }
}
