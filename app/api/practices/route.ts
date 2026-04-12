/**
 * @file /api/practices — Practice management
 * @description
 *   GET  — List all practices (admin only).
 *   POST — Create a new practice (admin only).
 * @security Requires authenticated session; admin role enforced for write ops.
 */
import { NextRequest, NextResponse } from 'next/server'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { z } from 'zod'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  key: z.string().max(20).optional(),
  shortName: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  fax: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  npi: z.string().max(20).optional(),
  taxId: z.string().max(30).optional(),
  logoUrl: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const denied = await requirePermission(req, 'patients_view')
  if (denied) return denied

  try {
    const practices = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT p.id, p.name, p.shortName, p.key, p.phone, p.fax, p.email, p.website,
              p.npi, p.taxId, p.logoUrl, p.active, p.createdAt, p.updatedAt
       FROM Practice p
       WHERE p.active = 1
       ORDER BY p.name ASC`
    )

    // Enrich with locations
    const practiceIds = practices.map(p => p.id as string)
    let locationRows: Array<Record<string, unknown>> = []
    if (practiceIds.length > 0) {
      const placeholders = practiceIds.map(() => '?').join(',')
      locationRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, name, key, active, practiceId FROM Location WHERE practiceId IN (${placeholders}) AND deletedAt IS NULL ORDER BY name ASC`,
        ...practiceIds
      )
    }

    const locByPractice: Record<string, Array<Record<string, unknown>>> = {}
    for (const loc of locationRows) {
      const pid = loc.practiceId as string
      if (!locByPractice[pid]) locByPractice[pid] = []
      locByPractice[pid].push(loc)
    }

    const enriched = practices.map(p => ({
      ...p,
      locations: locByPractice[p.id as string] ?? [],
    }))

    return NextResponse.json({ practices: enriched })
  } catch (error) {
    console.error('GET /api/practices error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, 'patients_view')
  if (denied) return denied

  try {
    const session = (await import('@/lib/auth/session')).verifySession
    const s = await session(req)
    if (s?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const result = createSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const d = result.data
    const id = `prac-${Date.now().toString(36)}`
    const now = new Date().toISOString()

    await prisma.$executeRaw`INSERT INTO Practice (id, name, key, shortName, phone, fax, email, website, npi, taxId, logoUrl, active, createdAt, updatedAt)
      VALUES (${id}, ${d.name}, ${d.key ?? null}, ${d.shortName ?? null}, ${d.phone ?? null}, ${d.fax ?? null}, ${d.email ?? null}, ${d.website ?? null}, ${d.npi ?? null}, ${d.taxId ?? null}, ${d.logoUrl ?? null}, 1, ${now}, ${now})`

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Practice WHERE id = ?`, id
    )
    return NextResponse.json({ practice: rows[0] }, { status: 201 })
  } catch (error) {
    console.error('POST /api/practices error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
