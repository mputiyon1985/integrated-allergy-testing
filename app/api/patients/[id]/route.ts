/**
 * @file /api/patients/[id] — Single patient record operations
 * @description Retrieves and updates a specific patient by internal ID.
 *   GET — Fetch full patient record including test results, forms, videos, and audit logs.
 *   PUT — Update patient demographic, clinical, or status fields (partial update supported).
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(_request, 'patients_view')
  if (denied) return denied
  try {
    const { id } = await params

    // Fetch patient with raw SQL (DateTime model)
    const patientRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Patient WHERE id = ? AND deletedAt IS NULL`, id
    )
    if (!patientRows[0]) {
      return NextResponse.json({ error: 'Patient not found', id }, { status: 404 })
    }
    const patient = patientRows[0]

    // Fetch related data using safe ORM (no DateTime issues) and raw SQL as needed
    const [testResults, videoActivity, formActivity, auditLogs, doctor, dates] = await Promise.all([
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT t.*, a.id as allergen_id, a.name as allergen_name, a.type as allergen_category
         FROM AllergyTestResult t
         LEFT JOIN Allergen a ON a.id = t.allergenId
         WHERE t.patientId = ? AND t.active = 1
         ORDER BY t.testedAt DESC`, id
      ),
      prisma.videoActivity.findMany({
        where: { patientId: id },
        include: { video: true },
      }),
      prisma.formActivity.findMany({
        where: { patientId: id },
        include: { form: true },
      }),
      prisma.auditLog.findMany({
        where: { patientId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      patient.doctorId
        ? prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT * FROM Doctor WHERE id = ? LIMIT 1`, patient.doctorId
          ).then(rows => rows[0] ?? null)
        : Promise.resolve(null),
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM PatientDate WHERE patientId = ?`, id
      ),
    ])

    // Shape test results to match expected include format
    const shapedTestResults = (testResults as Array<Record<string, unknown>>).map(r => ({
      ...r,
      allergen: r.allergen_id ? {
        id: r.allergen_id,
        name: r.allergen_name,
        category: r.allergen_category,
      } : null,
    }))

    return NextResponse.json({
      ...patient,
      doctor,
      dates,
      testResults: shapedTestResults,
      videoActivity,
      formActivity,
      auditLogs,
    }, { headers: HIPAA_HEADERS })
  } catch (error) {
    const err = error as Error
    console.error('GET /api/patients/[id] error:', err.message)
    return NextResponse.json({ error: err.message, id: 'unknown' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(request, 'patients_edit')
  if (denied) return denied
  try {
    const { id } = await params
    const body = await request.json() as Record<string, string | number | boolean | null | undefined>

    const {
      name,
      dob,
      email,
      phone,
      physician,
      clinicLocation,
      diagnosis,
      notes,
      doctorId,
      status,
      insuranceId,
    } = body

    const now = new Date().toISOString()

    await prisma.$executeRaw`UPDATE Patient SET
      name = COALESCE(${name !== undefined ? (name as string) : null}, name),
      dob = COALESCE(${dob !== undefined ? (dob as string) : null}, dob),
      email = COALESCE(${email !== undefined ? (email as string) : null}, email),
      phone = COALESCE(${phone !== undefined ? (phone as string) : null}, phone),
      homePhone = COALESCE(${body.homePhone !== undefined ? (body.homePhone as string) : null}, homePhone),
      street = COALESCE(${body.street !== undefined ? (body.street as string) : null}, street),
      apt = COALESCE(${body.apt !== undefined ? (body.apt as string) : null}, apt),
      city = COALESCE(${body.city !== undefined ? (body.city as string) : null}, city),
      state = COALESCE(${body.state !== undefined ? (body.state as string) : null}, state),
      zip = COALESCE(${body.zip !== undefined ? (body.zip as string) : null}, zip),
      physician = COALESCE(${physician !== undefined ? (physician as string) : null}, physician),
      clinicLocation = COALESCE(${clinicLocation !== undefined ? (clinicLocation as string) : null}, clinicLocation),
      diagnosis = COALESCE(${diagnosis !== undefined ? (diagnosis as string) : null}, diagnosis),
      notes = COALESCE(${notes !== undefined ? (notes as string) : null}, notes),
      doctorId = COALESCE(${doctorId !== undefined ? (doctorId as string) : null}, doctorId),
      status = COALESCE(${status !== undefined ? (status as string) : null}, status),
      insuranceId = COALESCE(${insuranceId !== undefined ? (insuranceId as string) : null}, insuranceId),
      insuranceProvider = COALESCE(${body.insuranceProvider !== undefined ? (body.insuranceProvider as string) : null}, insuranceProvider),
      insuranceGroup = COALESCE(${body.insuranceGroup !== undefined ? (body.insuranceGroup as string) : null}, insuranceGroup),
      emergencyName = COALESCE(${body.emergencyName !== undefined ? (body.emergencyName as string) : null}, emergencyName),
      emergencyPhone = COALESCE(${body.emergencyPhone !== undefined ? (body.emergencyPhone as string) : null}, emergencyPhone),
      emergencyRelation = COALESCE(${body.emergencyRelation !== undefined ? (body.emergencyRelation as string) : null}, emergencyRelation),
      updatedAt = ${now}
    WHERE id = ${id} AND deletedAt IS NULL`

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Patient WHERE id = ?`, id
    )
    if (!rows[0]) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'Patient',
        entityId: id,
        patientId: id,
        details: `Updated patient ${rows[0].patientId as string ?? id}`,
      },
    })

    return NextResponse.json(rows[0], { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('PUT /api/patients/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
