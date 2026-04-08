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

export const dynamic = 'force-dynamic'

export async function GET() {
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
    const body = await req.json() as { patientId: string; patientName: string; notes?: string; videosWatched?: number }
    const entry = await prisma.waitingRoom.create({
      data: {
        patientId: body.patientId,
        patientName: body.patientName,
        notes: body.notes,
        videosWatched: body.videosWatched ?? 0,
        status: 'waiting',
      },
    })
    return NextResponse.json({ entry }, { status: 201, headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('POST /api/waiting-room error:', err)
    return NextResponse.json({ error: 'Failed to add to waiting room' }, { status: 500 })
  }
}
