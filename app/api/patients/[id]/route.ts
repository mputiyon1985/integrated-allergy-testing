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

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        doctor: true,
        dates: true,
        testResults: {
          include: { allergen: true, dates: true },
        },
        videoActivity: {
          include: { video: true },
        },
        formActivity: {
          include: { form: true },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    return NextResponse.json(patient, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('GET /api/patients/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name as string } : {}),
        ...(dob !== undefined ? { dob: new Date(dob as string) } : {}),
        ...(email !== undefined ? { email: email as string } : {}),
        ...(phone !== undefined ? { phone: phone as string } : {}),
        ...(physician !== undefined ? { physician: physician as string } : {}),
        ...(clinicLocation !== undefined ? { clinicLocation: clinicLocation as string } : {}),
        ...(diagnosis !== undefined ? { diagnosis: diagnosis as string } : {}),
        ...(notes !== undefined ? { notes: notes as string } : {}),
        ...(doctorId !== undefined ? { doctorId: doctorId as string } : {}),
        ...(status !== undefined ? { status: status as string } : {}),
        ...(insuranceId !== undefined ? { insuranceId: insuranceId as string } : {}),
      },
    })

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'Patient',
        entityId: patient.id,
        patientId: patient.id,
        details: `Updated patient ${patient.patientId}`,
      },
    })

    return NextResponse.json(patient, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('PUT /api/patients/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
