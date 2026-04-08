/**
 * @file /api/nurses/[id] — Single nurse operations
 * @description
 *   GET    — Fetch a single nurse by ID.
 *   PUT    — Update nurse fields.
 *   DELETE — Soft delete (set deletedAt).
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const nurse = await prisma.nurse.findFirst({
      where: { id, deletedAt: null },
    })
    if (!nurse) {
      return NextResponse.json({ error: 'Nurse not found' }, { status: 404 })
    }
    return NextResponse.json(nurse)
  } catch (error) {
    console.error('GET /api/nurses/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json() as {
      name?: string
      title?: string
      email?: string
      phone?: string
      clinicLocation?: string
      active?: boolean
    }

    const existing = await prisma.nurse.findFirst({ where: { id, deletedAt: null } })
    if (!existing) {
      return NextResponse.json({ error: 'Nurse not found' }, { status: 404 })
    }

    const nurse = await prisma.nurse.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.clinicLocation !== undefined ? { clinicLocation: body.clinicLocation } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    })

    prisma.auditLog.create({
      data: {
        action: 'NURSE_UPDATED',
        entity: 'Nurse',
        entityId: nurse.id,
        patientId: null,
        details: `Nurse updated: ${nurse.name}`,
      },
    }).catch(() => {})

    return NextResponse.json(nurse)
  } catch (error) {
    console.error('PUT /api/nurses/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.nurse.findFirst({ where: { id, deletedAt: null } })
    if (!existing) {
      return NextResponse.json({ error: 'Nurse not found' }, { status: 404 })
    }

    await prisma.nurse.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    })

    prisma.auditLog.create({
      data: {
        action: 'NURSE_DELETED',
        entity: 'Nurse',
        entityId: id,
        patientId: null,
        details: `Nurse deleted: ${existing.name}`,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/nurses/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
