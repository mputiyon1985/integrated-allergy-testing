/**
 * GET  /api/email/templates — list all active templates
 * POST /api/email/templates — create new template
 */
import { NextRequest, NextResponse } from 'next/server'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = await requirePermission(request, 'patients_view')
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === '1'
    const templates = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      all
        ? `SELECT * FROM EmailTemplate ORDER BY name ASC`
        : `SELECT * FROM EmailTemplate WHERE active = 1 ORDER BY name ASC`
    )
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('GET /api/email/templates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await requirePermission(request, 'patients_view')
  if (denied) return denied

  try {
    const body = await request.json() as {
      name: string
      subject: string
      body: string
      category?: string
      active?: number
    }

    if (!body.name || !body.subject || !body.body) {
      return NextResponse.json({ error: 'name, subject, and body are required' }, { status: 400 })
    }

    const id = `etpl-${Date.now().toString(36)}`
    const now = new Date().toISOString()

    await prisma.$executeRaw`INSERT INTO EmailTemplate (id, name, subject, body, category, active, createdAt, updatedAt)
      VALUES (${id}, ${body.name}, ${body.subject}, ${body.body}, ${body.category ?? null}, ${body.active ?? 1}, ${now}, ${now})`

    const created = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM EmailTemplate WHERE id = ?`, id
    )
    return NextResponse.json(created[0], { status: 201 })
  } catch (error) {
    console.error('POST /api/email/templates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
