/**
 * @file /api/doctors/[id] — Single doctor operations
 * @description
 *   GET    — Fetch a single doctor by ID.
 *   PUT    — Update doctor fields.
 *   DELETE — Soft delete (set deletedAt).
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const doctor = await prisma.doctor.findFirst({
      where: { id, deletedAt: null },
    })
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }
    return NextResponse.json(doctor)
  } catch (error) {
    console.error('GET /api/doctors/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(request, 'doctors_manage')
  if (denied) return denied
  try {
    const { id } = await params
    const body = await request.json() as {
      name?: string
      title?: string
      specialty?: string
      email?: string
      phone?: string
      clinicLocation?: string
      active?: boolean
    }

    const existing = await prisma.doctor.findFirst({ where: { id, deletedAt: null } })
    if (!existing) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    const doctor = await prisma.doctor.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.specialty !== undefined ? { specialty: body.specialty } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.clinicLocation !== undefined ? { clinicLocation: body.clinicLocation } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    })

    prisma.auditLog.create({
      data: {
        action: 'DOCTOR_UPDATED',
        entity: 'Doctor',
        entityId: doctor.id,
        patientId: null,
        details: `Doctor updated: ${doctor.name}`,
      },
    }).catch(() => {})

    return NextResponse.json(doctor)
  } catch (error) {
    console.error('PUT /api/doctors/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(request, 'doctors_manage')
  if (denied) return denied
  try {
    const { id } = await params
    const existing = await prisma.doctor.findFirst({ where: { id, deletedAt: null } })
    if (!existing) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    await prisma.doctor.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    })

    prisma.auditLog.create({
      data: {
        action: 'DOCTOR_DELETED',
        entity: 'Doctor',
        entityId: id,
        patientId: null,
        details: `Doctor deleted: ${existing.name}`,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/doctors/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
