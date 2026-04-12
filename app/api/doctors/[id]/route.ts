/**
 * @file /api/doctors/[id] — Single doctor operations
 * @description
 *   GET    — Fetch a single doctor by ID.
 *   PUT    — Update doctor fields.
 *   DELETE — Soft delete (set deletedAt).
 */
import { NextRequest, NextResponse } from 'next/server'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Doctor WHERE id = ? AND deletedAt IS NULL`, id
    )
    if (!rows[0]) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }
    return NextResponse.json(rows[0])
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
      practiceId?: string | null
      locationId?: string | null
    }

    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id FROM Doctor WHERE id = ? AND deletedAt IS NULL`, id
    )
    if (!existingRows[0]) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    await prisma.$executeRaw`UPDATE Doctor SET
      name = COALESCE(${body.name ?? null}, name),
      title = COALESCE(${body.title ?? null}, title),
      specialty = COALESCE(${body.specialty ?? null}, specialty),
      email = COALESCE(${body.email ?? null}, email),
      phone = COALESCE(${body.phone ?? null}, phone),
      clinicLocation = COALESCE(${body.clinicLocation ?? null}, clinicLocation),
      active = COALESCE(${body.active !== undefined ? (body.active ? 1 : 0) : null}, active),
      practiceId = CASE WHEN ${body.practiceId !== undefined ? 1 : 0} = 1 THEN ${body.practiceId ?? null} ELSE practiceId END,
      locationId = CASE WHEN ${body.locationId !== undefined ? 1 : 0} = 1 THEN ${body.locationId ?? null} ELSE locationId END,
      updatedAt = ${now}
    WHERE id = ${id}`

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Doctor WHERE id = ? AND (deletedAt IS NULL OR deletedAt = \'\')`, id
    )

    prisma.auditLog.create({
      data: {
        action: 'DOCTOR_UPDATED',
        entity: 'Doctor',
        entityId: id,
        patientId: null,
        details: `Doctor updated: ${rows[0]?.name ?? id}`,
      },
    }).catch((e: unknown) => console.error('[audit]', e))

    return NextResponse.json(rows[0] ?? { id })
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
    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, name FROM Doctor WHERE id = ? AND deletedAt IS NULL`, id
    )
    if (!existingRows[0]) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    await prisma.$executeRaw`UPDATE Doctor SET deletedAt = ${now}, active = 0, updatedAt = ${now} WHERE id = ${id}`

    prisma.auditLog.create({
      data: {
        action: 'DOCTOR_DELETED',
        entity: 'Doctor',
        entityId: id,
        patientId: null,
        details: `Doctor deleted: ${existingRows[0].name as string}`,
      },
    }).catch((e: unknown) => console.error('[audit]', e))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/doctors/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
