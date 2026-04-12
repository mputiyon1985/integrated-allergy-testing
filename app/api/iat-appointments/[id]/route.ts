/**
 * @file /api/iat-appointments/[id] — Update or soft-delete a single appointment
 */
import { NextRequest, NextResponse } from 'next/server'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { z } from 'zod'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  patientId: z.string().optional(),
  patientName: z.string().max(200).optional().nullable(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  type: z.string().optional(),
  notes: z.string().max(1000).optional().nullable(),
  status: z.enum(['scheduled', 'in-progress', 'complete', 'cancelled']).optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(request, 'appointments_edit')
  if (denied) return denied
  try {
    const { id } = await params
    const body = await request.json()
    const result = updateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const rows = await prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM IatAppointment WHERE id = ${id} AND deletedAt IS NULL LIMIT 1`
    const existing = rows[0] ?? null
    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const data = result.data
    const now = new Date().toISOString()

    // Build SET clause safely with hardcoded column names
    const setClauses: string[] = ['updatedAt=?']
    const values: unknown[] = [now]

    if (data.title !== undefined) { setClauses.push('title=?'); values.push(data.title) }
    if (data.patientId !== undefined) { setClauses.push('patientId=?'); values.push(data.patientId) }
    if (data.patientName !== undefined) { setClauses.push('patientName=?'); values.push(data.patientName) }
    if (data.startTime !== undefined) { setClauses.push('startTime=?'); values.push(data.startTime) }
    if (data.endTime !== undefined) { setClauses.push('endTime=?'); values.push(data.endTime) }
    if (data.type !== undefined) { setClauses.push('type=?'); values.push(data.type) }
    if (data.notes !== undefined) { setClauses.push('notes=?'); values.push(data.notes) }
    if (data.status !== undefined) { setClauses.push('status=?'); values.push(data.status) }
    values.push(id)

    await prisma.$executeRawUnsafe(
      `UPDATE IatAppointment SET ${setClauses.join(', ')} WHERE id=?`,
      ...values
    )

    prisma.auditLog.create({
      data: { action: 'APPOINTMENT_UPDATED', entity: 'IATAppointment', entityId: id, patientId: null, details: 'Appointment updated' },
    }).catch(() => {})

    return NextResponse.json({ id })
  } catch (error) {
    console.error('PUT /api/iat-appointments/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(request, 'appointments_delete')
  if (denied) return denied
  try {
    const { id } = await params
    const rows = await prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM IatAppointment WHERE id = ${id} AND deletedAt IS NULL LIMIT 1`
    if (!rows[0]) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })

    const now = new Date().toISOString()
    await prisma.$executeRaw`UPDATE IatAppointment SET deletedAt=${now}, updatedAt=${now} WHERE id=${id}`

    prisma.auditLog.create({
      data: { action: 'APPOINTMENT_DELETED', entity: 'IATAppointment', entityId: id, patientId: null, details: 'Appointment deleted' },
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/iat-appointments/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
