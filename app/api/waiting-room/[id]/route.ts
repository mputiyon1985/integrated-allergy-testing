/**
 * @file /api/waiting-room/[id] — Individual waiting-room entry management
 * @description
 *   PUT    — Updates a waiting-room entry status, nurse assignment, or video ack.
 *   DELETE — Removes an entry from the waiting room (discharge/dismiss).
 *   Staff-facing endpoint.
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['waiting', 'in-service', 'complete', 'cancelled']

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, 'waiting_room_manage')
  if (denied) return denied
  try {
    const { id } = await params
    const body = await req.json() as { status?: string; nurseName?: string; nurseId?: string; videoAckBy?: string; notes?: string | null }

    // Validate status if provided
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400, headers: HIPAA_HEADERS })
    }

    const now = new Date().toISOString()

    // Build SET clauses
    const sets: string[] = ['updatedAt = ?']
    const vals: unknown[] = [now]

    if (body.status !== undefined) { sets.push('status = ?'); vals.push(body.status) }
    if (body.nurseName !== undefined) { sets.push('nurseName = ?'); vals.push(String(body.nurseName).slice(0, 200)) }
    if (body.nurseId !== undefined) { sets.push('nurseId = ?'); vals.push(body.nurseId) }
    if (body.videoAckBy !== undefined) {
      sets.push('videoAckBy = ?', 'videoAckAt = ?')
      vals.push(body.videoAckBy, now)
    }
    if (body.notes !== undefined) { sets.push('notes = ?'); vals.push(body.notes) }
    if (body.status === 'in-service') { sets.push('calledAt = ?'); vals.push(now) }
    if (body.status === 'complete') { sets.push('completedAt = ?'); vals.push(now) }

    await prisma.$executeRawUnsafe(
      `UPDATE WaitingRoom SET ${sets.join(', ')} WHERE id = ?`,
      ...vals, id
    )

    const entryRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM WaitingRoom WHERE id = ?`, id
    )
    const entry = entryRows[0]

    // When completing, calculate timing and store on any linked encounter
    if (body.status === 'complete' && entry) {
      try {
        const wr = entry
        if (wr?.patientId && wr.checkedInAt) {
          const calledAtRaw = wr.calledAt ? new Date(wr.calledAt as string | number) : new Date()
          const completedAt = new Date()
          const waitMins = Math.round((calledAtRaw.getTime() - new Date(wr.checkedInAt as string | number).getTime()) / 60000)
          const inServiceMins = Math.round((completedAt.getTime() - calledAtRaw.getTime()) / 60000)

          // Find the most recent open encounter for this patient
          const encounterRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT id FROM Encounter
             WHERE patientId=? AND deletedAt IS NULL AND status != 'closed'
             ORDER BY createdAt DESC LIMIT 1`,
            wr.patientId as string
          )
          const encounter = encounterRows[0] ?? null
          if (encounter) {
            await prisma.$executeRawUnsafe(
              `UPDATE Encounter SET waitMinutes=?, inServiceMinutes=?, waitingRoomId=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
              waitMins > 0 ? waitMins : 0,
              inServiceMins > 0 ? inServiceMins : 0,
              id,
              encounter.id as string
            )
          }
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ entry }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('PUT /api/waiting-room/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update waiting room entry' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, 'waiting_room_manage')
  if (denied) return denied
  try {
    const { id } = await params
    const now = new Date().toISOString()
    // Soft delete — mark as complete rather than removing
    await prisma.$executeRaw`UPDATE WaitingRoom SET status = 'complete', completedAt = ${now}, updatedAt = ${now} WHERE id = ${id}`

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM WaitingRoom WHERE id = ?`, id
    )
    return NextResponse.json({ ok: true, entry: rows[0] ?? null }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('DELETE /api/waiting-room/[id] error:', err)
    return NextResponse.json({ error: 'Failed to remove waiting room entry' }, { status: 500 })
  }
}
