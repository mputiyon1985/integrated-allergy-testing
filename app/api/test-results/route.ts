/**
 * @file /api/test-results — Allergy test result list and creation
 * @description Manages allergy test results across patients.
 *   GET  — List test results; supports ?patientId= filter.
 *   POST — Record a new test result (patientId, allergenId, testType, reaction required).
 *          testType must be 'scratch' or 'intradermal'; reaction must be 0–5.
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const createTestResultSchema = z.object({
  patientId: z.string().min(1),
  allergenId: z.string().min(1),
  testType: z.enum(['scratch', 'intradermal']),
  reaction: z.number().int().min(0).max(5),
  wheal: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
  nurseName: z.string().max(200).optional(),
})

export async function GET(request: NextRequest) {
  const denied = await requirePermission(request, 'test_results_view')
  if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')

    let sql = `SELECT t.*, a.id as allergen_id, a.name as allergen_name, a.category as allergen_category,
                      p.id as patient_id, p.patientId as patient_patientId, p.name as patient_name
               FROM AllergyTestResult t
               LEFT JOIN Allergen a ON a.id = t.allergenId
               LEFT JOIN Patient p ON p.id = t.patientId
               WHERE t.active = 1`
    const values: unknown[] = []

    if (patientId) {
      sql += ' AND t.patientId = ?'
      values.push(patientId)
    }

    sql += ' ORDER BY t.testedAt DESC'

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...values)

    // Shape to expected format
    const testResults = rows.map(r => ({
      ...r,
      allergen: r.allergen_id ? {
        id: r.allergen_id,
        name: r.allergen_name,
        category: r.allergen_category,
      } : null,
      patient: r.patient_id ? {
        id: r.patient_id,
        patientId: r.patient_patientId,
        name: r.patient_name,
      } : null,
    }))

    return NextResponse.json(testResults, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('GET /api/test-results error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await requirePermission(request, 'test_results_create')
  if (denied) return denied
  try {
    const body = await request.json()

    const result = createTestResultSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { patientId, allergenId, testType, reaction, wheal, notes, nurseName } = result.data

    const id = `tst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const now = new Date().toISOString()

    await prisma.$executeRaw`INSERT INTO AllergyTestResult (id, patientId, allergenId, testType, reaction, wheal, notes, nurseName, active, testedAt, createdAt, updatedAt)
      VALUES (${id}, ${patientId}, ${allergenId}, ${testType}, ${reaction}, ${wheal ?? null}, ${notes ?? null}, ${nurseName ?? null}, 1, ${now}, ${now}, ${now})`

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT t.*, a.id as allergen_id, a.name as allergen_name, a.category as allergen_category
       FROM AllergyTestResult t
       LEFT JOIN Allergen a ON a.id = t.allergenId
       WHERE t.id = ?`, id
    )
    const testResult = rows[0] ? {
      ...rows[0],
      allergen: rows[0].allergen_id ? {
        id: rows[0].allergen_id,
        name: rows[0].allergen_name,
        category: rows[0].allergen_category,
      } : null,
    } : { id, patientId, allergenId, testType, reaction }

    // Fire-and-forget: record encounter activity
    fetch(`${request.nextUrl.origin}/api/encounter-activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        type: 'allergy_test',
        linkedTestResultId: id,
        notes: `${testType} test: ${allergenId}, reaction ${reaction}`,
        performedBy: nurseName || 'Staff',
      }),
    }).catch((e: unknown) => console.error('[audit]', e))

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'AllergyTestResult',
        entityId: id,
        patientId,
        details: `Created ${testType} test result for allergen ${allergenId}, reaction: ${reaction}`,
      },
    })

    return NextResponse.json(testResult, { status: 201, headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('POST /api/test-results error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
