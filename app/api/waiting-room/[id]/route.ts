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

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['waiting', 'in-service', 'complete', 'cancelled']

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json() as { status?: string; nurseName?: string; nurseId?: string; videoAckBy?: string; notes?: string | null }
    
    // Validate status if provided
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400, headers: HIPAA_HEADERS })
    }

    const data: Record<string, unknown> = {}
    if (body.status) data.status = body.status
    if (body.nurseName) data.nurseName = String(body.nurseName).slice(0, 200)
    if (body.nurseId) data.nurseId = body.nurseId
    if (body.videoAckBy) { data.videoAckBy = body.videoAckBy; data.videoAckAt = new Date() }
    if (body.notes !== undefined) data.notes = body.notes
    if (body.status === 'in-service') data.calledAt = new Date()
    if (body.status === 'complete') data.completedAt = new Date()

    const entry = await prisma.waitingRoom.update({ where: { id }, data })
    return NextResponse.json({ entry }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('PUT /api/waiting-room/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Soft delete — mark as complete rather than removing
    await prisma.waitingRoom.update({ where: { id }, data: { status: 'complete', completedAt: new Date() } })
    return NextResponse.json({ ok: true }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('DELETE /api/waiting-room/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
