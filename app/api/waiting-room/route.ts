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
    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get('locationId')
    const practiceId = searchParams.get('practiceId')

    let sql = `SELECT * FROM WaitingRoom WHERE status IN ('waiting','in-service')`
    const values: unknown[] = []

    if (locationId) {
      sql += ' AND locationId = ?'
      values.push(locationId)
    } else if (practiceId) {
      sql += ' AND locationId IN (SELECT id FROM Location WHERE practiceId = ? AND deletedAt IS NULL)'
      values.push(practiceId)
    }

    sql += ' ORDER BY checkedInAt ASC'

    const entries = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...values)
    return NextResponse.json({ entries }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('[api/waiting-room:GET]', { error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() })
    return NextResponse.json({ entries: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { patientId?: string; patientName?: string; notes?: string; videosWatched?: number; locationId?: string }

    // Validate required fields
    if (!body.patientId || !body.patientName) {
      return NextResponse.json({ error: 'patientId and patientName are required' }, { status: 400, headers: HIPAA_HEADERS })
    }

    // Validate that the patientId actually exists in the database to prevent spoofing
    const patientRows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
      `SELECT id, name FROM Patient WHERE id = ? AND deletedAt IS NULL LIMIT 1`, body.patientId
    )
    if (!patientRows[0]) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404, headers: HIPAA_HEADERS })
    }
    const patient = patientRows[0]

    // Dedup: if patient already has an active (waiting/in-service) entry, return it
    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM WaitingRoom WHERE patientId = ? AND status IN ('waiting','in-service') LIMIT 1`, patient.id
    )
    if (existingRows[0]) {
      return NextResponse.json({ entry: existingRows[0], deduplicated: true }, { headers: HIPAA_HEADERS })
    }

    // Sanitize inputs and use verified name from DB, not user-provided name
    const videosWatched = typeof body.videosWatched === 'number' && body.videosWatched >= 0
      ? Math.floor(body.videosWatched)
      : 0

    const id = `wr-${Date.now().toString(36)}`
    const now = new Date().toISOString()
    const notes = body.notes ? String(body.notes).slice(0, 500) : null
    // Use locationId from request body, fall back to 'loc-iat-001'
    const locationId = body.locationId ? String(body.locationId).slice(0, 50) : 'loc-iat-001'

    await prisma.$executeRaw`INSERT INTO WaitingRoom (id, patientId, patientName, notes, videosWatched, status, locationId, checkedInAt)
      VALUES (${id}, ${patient.id}, ${patient.name}, ${notes}, ${videosWatched}, 'waiting', ${locationId}, ${now})`

    const entryRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM WaitingRoom WHERE id = ?`, id
    )
    const entry = entryRows[0] ?? { id, patientId: patient.id, patientName: patient.name, status: 'waiting' }

    // Auto-create kiosk_checkin encounter activity
    fetch(`${process.env.NEXTAUTH_URL || 'https://integrated-allergy-testing.vercel.app'}/api/encounter-activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: patient.id,
        type: 'kiosk_checkin',
        notes: `Patient checked in via kiosk. Videos watched: ${videosWatched}`,
        performedBy: 'Patient (Kiosk)',
      }),
    }).catch(() => {})

    return NextResponse.json({ entry }, { status: 201, headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('[api/waiting-room:POST]', { error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() })
    return NextResponse.json({ error: 'Failed to add to waiting room' }, { status: 500 })
  }
}
