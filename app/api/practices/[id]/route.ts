/**
 * @file /api/practices/[id] — Get or update a specific practice
 * @security Requires authenticated session; admin role enforced for PUT.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  shortName: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  fax: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  npi: z.string().max(20).optional(),
  taxId: z.string().max(30).optional(),
  logoUrl: z.string().optional(),
  active: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(req, 'patients_view')
  if (denied) return denied

  try {
    const { id } = await params
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Practice WHERE id = ?`, id
    )
    if (!rows[0]) {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 })
    }

    // Enrich with locations
    const locationRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, name, key, active, city, state FROM Location WHERE practiceId = ? AND deletedAt IS NULL ORDER BY name ASC`, id
    )

    return NextResponse.json({ practice: { ...rows[0], locations: locationRows } })
  } catch (error) {
    console.error('GET /api/practices/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(req, 'patients_view')
  if (denied) return denied

  try {
    const { verifySession } = await import('@/lib/auth/session')
    const s = await verifySession(req)
    if (s?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const result = updateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const d = result.data
    const now = new Date().toISOString()

    await prisma.$executeRaw`UPDATE Practice SET
      name = COALESCE(${d.name ?? null}, name),
      shortName = COALESCE(${d.shortName ?? null}, shortName),
      phone = COALESCE(${d.phone ?? null}, phone),
      fax = COALESCE(${d.fax ?? null}, fax),
      email = COALESCE(${d.email ?? null}, email),
      website = COALESCE(${d.website ?? null}, website),
      npi = COALESCE(${d.npi ?? null}, npi),
      taxId = COALESCE(${d.taxId ?? null}, taxId),
      logoUrl = COALESCE(${d.logoUrl ?? null}, logoUrl),
      active = COALESCE(${d.active !== undefined ? (d.active ? 1 : 0) : null}, active),
      updatedAt = ${now}
    WHERE id = ${id}`

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Practice WHERE id = ?`, id
    )
    if (!rows[0]) return NextResponse.json({ error: 'Practice not found' }, { status: 404 })
    return NextResponse.json({ practice: rows[0] })
  } catch (error) {
    console.error('PUT /api/practices/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
