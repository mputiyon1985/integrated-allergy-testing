/**
 * @file /api/patients — Patient list and creation
 * @description Manages the patient roster.
 *   GET  — List all active patients; supports ?search= query param.
 *   POST — Create a new patient record (name, dob required).
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const patients = await prisma.patient.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { patientId: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        patientId: true,
        name: true,
        dob: true,
        status: true,
        doctorId: true,
        clinicLocation: true,
        physician: true,
      },
      orderBy: [{ name: 'asc' }],
    })

    return NextResponse.json(patients, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('GET /api/patients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name?: string
      dob?: string
      email?: string
      phone?: string
      physician?: string
      clinicLocation?: string
      diagnosis?: string
      notes?: string
      insuranceId?: string
      insuranceProvider?: string
      doctorId?: string
    }

    const { name, dob } = body

    if (!name || !dob) {
      return NextResponse.json(
        { error: 'name and dob are required' },
        { status: 400 }
      )
    }

    const patientId = `PAT-${Date.now().toString(36).toUpperCase()}`

    const patient = await prisma.patient.create({
      data: {
        patientId,
        name,
        dob: new Date(dob),
        email: body.email,
        phone: body.phone,
        physician: body.physician,
        clinicLocation: body.clinicLocation,
        diagnosis: body.diagnosis,
        notes: body.notes,
        insuranceId: body.insuranceId,
        doctorId: body.doctorId,
      },
    })

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Patient',
        entityId: patient.id,
        patientId: patient.id,
        details: `Created patient ${patientId}: ${name}`,
      },
    })

    return NextResponse.json(patient, { status: 201, headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('POST /api/patients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
