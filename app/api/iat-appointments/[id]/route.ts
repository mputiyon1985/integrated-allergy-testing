/**
 * @file /api/iat-appointments/[id] — Update or soft-delete a single appointment
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'

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
  try {
    const { id } = await params
    const body = await request.json()
    const result = updateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.iATAppointment.findFirst({
      where: { id, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const data = result.data
    // Validate time order if both provided
    const start = data.startTime ? new Date(data.startTime) : existing.startTime
    const end = data.endTime ? new Date(data.endTime) : existing.endTime
    if (start >= end) {
      return NextResponse.json({ error: 'endTime must be after startTime' }, { status: 400 })
    }

    const updated = await prisma.iATAppointment.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.patientId !== undefined ? { patientId: data.patientId } : {}),
        ...(data.patientName !== undefined ? { patientName: data.patientName } : {}),
        ...(data.startTime !== undefined ? { startTime: new Date(data.startTime) } : {}),
        ...(data.endTime !== undefined ? { endTime: new Date(data.endTime) } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        updatedAt: new Date(),
      },
    })

    prisma.auditLog.create({
      data: {
        action: 'APPOINTMENT_UPDATED',
        entity: 'IATAppointment',
        entityId: updated.id,
        patientId: updated.patientId || null,
        details: `Appointment updated: ${updated.title} at ${updated.startTime}`,
      },
    }).catch(() => {})

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT /api/iat-appointments/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.iATAppointment.findFirst({
      where: { id, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    await prisma.iATAppointment.update({
      where: { id },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    })

    prisma.auditLog.create({
      data: {
        action: 'APPOINTMENT_DELETED',
        entity: 'IATAppointment',
        entityId: id,
        patientId: existing.patientId || null,
        details: `Appointment deleted: ${existing.title} at ${existing.startTime}`,
      },
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/iat-appointments/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
