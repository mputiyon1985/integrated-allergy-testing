import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

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
        location: true,
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

    return NextResponse.json(patient)
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
      honorific,
      firstName,
      lastName,
      dob,
      email,
      cellPhone,
      homePhone,
      homeAddress,
      city,
      state,
      zip,
      emergencyName,
      emergencyPhone,
      emergencyRelation,
      insuranceId,
      insuranceProvider,
      doctorId,
      locationId,
      status,
      notes,
    } = body

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        ...(honorific !== undefined ? { honorific: honorific as string } : {}),
        ...(firstName !== undefined ? { firstName: firstName as string } : {}),
        ...(lastName !== undefined ? { lastName: lastName as string } : {}),
        ...(dob !== undefined ? { dob: new Date(dob as string) } : {}),
        ...(email !== undefined ? { email: email as string } : {}),
        ...(cellPhone !== undefined ? { cellPhone: cellPhone as string } : {}),
        ...(homePhone !== undefined ? { homePhone: homePhone as string } : {}),
        ...(homeAddress !== undefined ? { homeAddress: homeAddress as string } : {}),
        ...(city !== undefined ? { city: city as string } : {}),
        ...(state !== undefined ? { state: state as string } : {}),
        ...(zip !== undefined ? { zip: zip as string } : {}),
        ...(emergencyName !== undefined ? { emergencyName: emergencyName as string } : {}),
        ...(emergencyPhone !== undefined ? { emergencyPhone: emergencyPhone as string } : {}),
        ...(emergencyRelation !== undefined ? { emergencyRelation: emergencyRelation as string } : {}),
        ...(insuranceId !== undefined ? { insuranceId: insuranceId as string } : {}),
        ...(insuranceProvider !== undefined ? { insuranceProvider: insuranceProvider as string } : {}),
        ...(doctorId !== undefined ? { doctorId: doctorId as string } : {}),
        ...(locationId !== undefined ? { locationId: locationId as string } : {}),
        ...(status !== undefined ? { status: status as string } : {}),
        ...(notes !== undefined ? { notes: notes as string } : {}),
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

    return NextResponse.json(patient)
  } catch (error) {
    console.error('PUT /api/patients/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
