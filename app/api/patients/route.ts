/**
 * @file /api/patients — Patient list and creation
 * @description Manages the patient roster.
 *   GET  — List all active patients; supports ?search= query param.
 *   POST — Create a new patient record (name, dob required).
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission, getUserAllowedLocations } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const createPatientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be YYYY-MM-DD'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  physician: z.string().max(200).optional(),
  clinicLocation: z.string().max(200).optional(),
  diagnosis: z.string().max(500).optional(),
  insuranceId: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
})

export async function GET(request: NextRequest) {
  const denied = await requirePermission(request, 'patients_view')
  if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    let locationId = searchParams.get('locationId')
    let practiceId = searchParams.get('practiceId')

    // Enforce per-user location scope via allowedLocations
    try {
      const { verifySession } = await import('@/lib/auth/session')
      const { getUserLocationScope } = await import('@/lib/location-scope')
      const userSession = await verifySession(request)
      if (userSession) {
        const scopedLocs = await getUserLocationScope({ id: String(userSession.id ?? userSession.userId ?? ""), role: String(userSession.role ?? "staff") })
        if (scopedLocs) {
          if (locationId && !scopedLocs.includes(locationId)) {
            return NextResponse.json([], { headers: HIPAA_HEADERS })
          }
          if (!locationId && !practiceId) {
            // Restrict to first allowed location as default scope
            locationId = scopedLocs.join(',').split(',')[0]
          }
        }
      }
    } catch { /* non-critical, continue */ }

    // ── Location-scoped access enforcement ──
    const { verifySession } = await import('@/lib/auth/session')
    const session = await verifySession(request)
    const sessionUserId = session?.id as string | undefined
    const allowedLocs = sessionUserId ? await getUserAllowedLocations(sessionUserId) : null

    // Build raw SQL query — Prisma ORM crashes on DateTime fields in Turso
    let sql = `SELECT id, patientId, name, dob, status, doctorId, clinicLocation, physician,
                      phone, email, insuranceProvider, insuranceId, insuranceGroup,
                      emergencyName, emergencyPhone, emergencyRelation, locationId, createdAt
               FROM Patient WHERE deletedAt IS NULL`
    const values: unknown[] = []

    if (allowedLocs) {
      // User has restricted access — enforce allowed locations
      const effectiveLocId = locationId && allowedLocs.includes(locationId) ? locationId : null
      if (effectiveLocId) {
        sql += ' AND locationId = ?'
        values.push(effectiveLocId)
      } else {
        const placeholders = allowedLocs.map(() => '?').join(',')
        sql += ` AND locationId IN (${placeholders})`
        values.push(...allowedLocs)
      }
    } else if (locationId) {
      sql += ' AND locationId = ?'
      values.push(locationId)
    } else if (practiceId) {
      sql += ' AND locationId IN (SELECT id FROM Location WHERE practiceId = ? AND deletedAt IS NULL)'
      values.push(practiceId)
    }

    if (search) {
      sql += ' AND (name LIKE ? OR patientId LIKE ? OR email LIKE ?)'
      const s = `%${search}%`
      values.push(s, s, s)
    }

    sql += ' ORDER BY name ASC LIMIT 500'

    const patients = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...values)

    return NextResponse.json(patients, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('[api/patients:GET]', { error: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await requirePermission(request, 'patients_create')
  if (denied) return denied
  try {
    const body = await request.json()

    const result = createPatientSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { name, dob } = result.data
    const bodyRaw = body as Record<string, string>

    // Use PA-XXXXXXXX nanoid-style format per architecture rules
    const { customAlphabet } = await import('nanoid')
    const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8)
    const patientId = `PA-${nanoid()}`

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const dobStr = dob // YYYY-MM-DD stored as string for Turso compatibility

    await prisma.$executeRaw`INSERT INTO Patient (
        id, patientId, name, dob, email, phone, homePhone,
        street, city, state, zip, apt,
        physician, clinicLocation, diagnosis, insuranceId,
        insuranceProvider, insuranceGroup,
        emergencyName, emergencyPhone, emergencyRelation,
        notes, doctorId, status, startDate, createdAt, updatedAt
      ) VALUES (
        ${id}, ${patientId}, ${name}, ${dobStr},
        ${result.data.email ?? null}, ${result.data.phone ?? null}, ${bodyRaw.homePhone ?? null},
        ${bodyRaw.street ?? null}, ${bodyRaw.city ?? null}, ${bodyRaw.state ?? null}, ${bodyRaw.zip ?? null}, ${bodyRaw.apt ?? null},
        ${result.data.physician ?? ''}, ${result.data.clinicLocation ?? ''}, ${result.data.diagnosis ?? ''}, ${result.data.insuranceId ?? null},
        ${bodyRaw.insuranceProvider ?? null}, ${bodyRaw.insuranceGroup ?? null},
        ${bodyRaw.emergencyName ?? null}, ${bodyRaw.emergencyPhone ?? null}, ${bodyRaw.emergencyRelation ?? null},
        ${result.data.notes ?? null}, ${(body as { doctorId?: string }).doctorId ?? null},
        'active', ${now}, ${now}, ${now}
      )`

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Patient WHERE id = ?`, id
    )
    const patient = rows[0] ?? { id, patientId, name }

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Patient',
        entityId: id,
        patientId: id,
        details: `Created patient ${patientId}: ${name}`,
      },
    })

    return NextResponse.json(patient, { status: 201, headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('[api/patients:POST]', { error: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
