/**
 * @file /api/doctors — Doctor/physician directory
 * @description Manages the referring physician list for patient assignments.
 *   GET  — List all active doctors.
 *   POST — Create a new doctor record (name required).
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const createDoctorSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(50).optional(),
  specialty: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  clinicLocation: z.string().max(200).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === '1'
    const locationId = searchParams.get('locationId')
    const practiceId = searchParams.get('practiceId')

    let sql = `SELECT * FROM Doctor WHERE deletedAt IS NULL`
    const values: unknown[] = []

    if (!all) {
      sql += ' AND active = 1'
    }

    if (locationId) {
      sql += ' AND (locationId = ? OR locationId IS NULL)'
      values.push(locationId)
    } else if (practiceId) {
      // Get location IDs for this practice, then filter
      const locs = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM Location WHERE practiceId = ? AND deletedAt IS NULL`, practiceId
      )
      if (locs.length > 0) {
        const placeholders = locs.map(() => '?').join(',')
        sql += ` AND (locationId IN (${placeholders}) OR locationId IS NULL)`
        values.push(...locs.map(l => l.id))
      }
    }

    sql += ' ORDER BY name ASC'

    const doctors = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...values)

    return NextResponse.json(doctors)
  } catch (error) {
    console.error('GET /api/doctors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await requirePermission(request, 'doctors_manage')
  if (denied) return denied
  try {
    const body = await request.json()

    const result = createDoctorSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { name, title, specialty, email, phone, clinicLocation } = result.data
    const npi = (body as { npi?: string }).npi ?? null
    const id = `doc-${Date.now().toString(36)}`
    const now = new Date().toISOString()

    await prisma.$executeRaw`INSERT INTO Doctor (id, name, title, specialty, email, phone, clinicLocation, npi, active, createdAt, updatedAt)
      VALUES (${id}, ${name}, ${title ?? null}, ${specialty ?? null}, ${email ?? null}, ${phone ?? null}, ${clinicLocation ?? null}, ${npi}, 1, ${now}, ${now})`

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Doctor WHERE id = ?`, id
    )
    return NextResponse.json(rows[0] ?? { id, name }, { status: 201 })
  } catch (error) {
    console.error('POST /api/doctors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
