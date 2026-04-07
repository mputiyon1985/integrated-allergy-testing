import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const locationId = searchParams.get('locationId')

    const patients = await prisma.patient.findMany({
      where: {
        active: true,
        ...(locationId ? { locationId } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { patientId: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        patientId: true,
        firstName: true,
        lastName: true,
        honorific: true,
        dob: true,
        status: true,
        doctorId: true,
        locationId: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    return NextResponse.json(patients)
  } catch (error) {
    console.error('GET /api/patients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      firstName?: string
      lastName?: string
      dob?: string
      honorific?: string
      email?: string
      cellPhone?: string
      homePhone?: string
      homeAddress?: string
      city?: string
      state?: string
      zip?: string
      emergencyName?: string
      emergencyPhone?: string
      emergencyRelation?: string
      insuranceId?: string
      insuranceProvider?: string
      doctorId?: string
      locationId?: string
    }

    const { firstName, lastName, dob } = body

    if (!firstName || !lastName || !dob) {
      return NextResponse.json(
        { error: 'firstName, lastName, and dob are required' },
        { status: 400 }
      )
    }

    const patientId = `PAT-${Date.now().toString(36).toUpperCase()}`

    const patient = await prisma.patient.create({
      data: {
        patientId,
        firstName,
        lastName,
        dob: new Date(dob),
        honorific: body.honorific,
        email: body.email,
        cellPhone: body.cellPhone,
        homePhone: body.homePhone,
        homeAddress: body.homeAddress,
        city: body.city,
        state: body.state,
        zip: body.zip,
        emergencyName: body.emergencyName,
        emergencyPhone: body.emergencyPhone,
        emergencyRelation: body.emergencyRelation,
        insuranceId: body.insuranceId,
        insuranceProvider: body.insuranceProvider,
        doctorId: body.doctorId,
        locationId: body.locationId,
      },
    })

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Patient',
        entityId: patient.id,
        patientId: patient.id,
        details: `Created patient ${patientId}: ${firstName} ${lastName}`,
      },
    })

    return NextResponse.json(patient, { status: 201 })
  } catch (error) {
    console.error('POST /api/patients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
