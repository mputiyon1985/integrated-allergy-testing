import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, 'settings_manage')
  if (denied) return denied
  try {
    const { id } = await params
    const body = await req.json() as { name?: string; color?: string; duration?: number; active?: boolean; sortOrder?: number }
    const reason = await prisma.appointmentReason.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.duration !== undefined && { duration: body.duration }),
        ...(body.active !== undefined && { active: body.active }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    })
    return NextResponse.json({ reason })
  } catch (err) {
    console.error('PUT /api/appointment-reasons/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update reason' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, 'settings_manage')
  if (denied) return denied
  try {
    const { id } = await params
    await prisma.appointmentReason.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/appointment-reasons/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete reason' }, { status: 500 })
  }
}
