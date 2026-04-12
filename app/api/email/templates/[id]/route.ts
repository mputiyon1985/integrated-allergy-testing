/**
 * GET/PUT/DELETE /api/email/templates/[id]
 */
import { NextRequest, NextResponse } from 'next/server'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(request, 'patients_view')
  if (denied) return denied

  const { id } = await params
  try {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM EmailTemplate WHERE id = ?`, id
    )
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('GET /api/email/templates/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(request, 'patients_view')
  if (denied) return denied

  const { id } = await params
  try {
    const body = await request.json() as {
      name?: string
      subject?: string
      body?: string
      category?: string
      active?: number
    }

    const now = new Date().toISOString()

    await prisma.$executeRaw`UPDATE EmailTemplate SET
      name = COALESCE(${body.name ?? null}, name),
      subject = COALESCE(${body.subject ?? null}, subject),
      body = COALESCE(${body.body ?? null}, body),
      category = COALESCE(${body.category ?? null}, category),
      active = COALESCE(${body.active ?? null}, active),
      updatedAt = ${now}
    WHERE id = ${id}`

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM EmailTemplate WHERE id = ?`, id
    )
    return NextResponse.json(rows[0] ?? { error: 'Not found' })
  } catch (error) {
    console.error('PUT /api/email/templates/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(request, 'patients_view')
  if (denied) return denied

  const { id } = await params
  try {
    await prisma.$executeRaw`DELETE FROM EmailTemplate WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/email/templates/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
