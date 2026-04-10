/**
 * @file /api/nurses/[id] — Single nurse operations
 * @description
 *   GET    — Fetch a single nurse by ID.
 *   PUT    — Update nurse fields.
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
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Nurse WHERE id = ? AND deletedAt IS NULL`, id
    )
    if (!rows[0]) {
      return NextResponse.json({ error: 'Nurse not found' }, { status: 404 })
    }
    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('GET /api/nurses/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(request, 'nurses_manage')
  if (denied) return denied
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

    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id FROM Nurse WHERE id = ? AND deletedAt IS NULL`, id
    )
    if (!existingRows[0]) {
      return NextResponse.json({ error: 'Nurse not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    await prisma.$executeRaw`UPDATE Nurse SET
      name = COALESCE(${body.name ?? null}, name),
      title = COALESCE(${body.title ?? null}, title),
      email = COALESCE(${body.email ?? null}, email),
      phone = COALESCE(${body.phone ?? null}, phone),
      clinicLocation = COALESCE(${body.clinicLocation ?? null}, clinicLocation),
      active = COALESCE(${body.active !== undefined ? (body.active ? 1 : 0) : null}, active),
      updatedAt = ${now}
    WHERE id = ${id}`

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Nurse WHERE id = ?`, id
    )

    prisma.auditLog.create({
      data: {
        action: 'NURSE_UPDATED',
        entity: 'Nurse',
        entityId: id,
        patientId: null,
        details: `Nurse updated: ${rows[0]?.name ?? id}`,
      },
    }).catch(() => {})

    return NextResponse.json(rows[0] ?? { id })
  } catch (error) {
    console.error('PUT /api/nurses/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(request, 'nurses_manage')
  if (denied) return denied
  try {
    const { id } = await params
    const existingRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, name FROM Nurse WHERE id = ? AND deletedAt IS NULL`, id
    )
    if (!existingRows[0]) {
      return NextResponse.json({ error: 'Nurse not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    await prisma.$executeRaw`UPDATE Nurse SET deletedAt = ${now}, active = 0, updatedAt = ${now} WHERE id = ${id}`

    prisma.auditLog.create({
      data: {
        action: 'NURSE_DELETED',
        entity: 'Nurse',
        entityId: id,
        patientId: null,
        details: `Nurse deleted: ${existingRows[0].name as string}`,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/nurses/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
