/**
 * @file /api/doctors — Doctor/physician directory
 * @description Manages the referring physician list for patient assignments.
 *   GET  — List all active doctors with their associated location.
 *   POST — Create a new doctor record (firstName and lastName required).
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { active: true },
      include: { location: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    return NextResponse.json(doctors)
  } catch (error) {
    console.error('GET /api/doctors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      honorific?: string
      firstName?: string
      lastName?: string
      locationId?: string
    }

    const { firstName, lastName } = body

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'firstName and lastName are required' },
        { status: 400 }
      )
    }

    const doctor = await prisma.doctor.create({
      data: {
        honorific: body.honorific,
        firstName,
        lastName,
        locationId: body.locationId,
      },
    })

    return NextResponse.json(doctor, { status: 201 })
  } catch (error) {
    console.error('POST /api/doctors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
