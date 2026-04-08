import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json() as { status: string; nurseName?: string; nurseId?: string }
    
    const data: Record<string, unknown> = { status: body.status }
    if (body.nurseName) data.nurseName = body.nurseName
    if (body.nurseId) data.nurseId = body.nurseId
    if (body.status === 'in-service') data.calledAt = new Date()
    if (body.status === 'complete') data.completedAt = new Date()

    const entry = await prisma.waitingRoom.update({ where: { id }, data })
    return NextResponse.json({ entry })
  } catch (err) {
    console.error('PUT /api/waiting-room/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.waitingRoom.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/waiting-room/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
