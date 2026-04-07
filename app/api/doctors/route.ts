/**
 * @file /api/doctors — Doctor/physician directory
 * @description Manages the referring physician list for patient assignments.
 *   GET  — List all active doctors.
 *   POST — Create a new doctor record (name required).
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { active: true },
      orderBy: [{ name: 'asc' }],
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
      name?: string
      title?: string
      specialty?: string
      email?: string
      phone?: string
      clinicLocation?: string
      npi?: string
    }

    const { name } = body

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    const doctor = await prisma.doctor.create({
      data: {
        name,
        ...(body.title ? { title: body.title } : {}),
        ...(body.specialty ? { specialty: body.specialty } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.clinicLocation ? { clinicLocation: body.clinicLocation } : {}),
        ...(body.npi ? { npi: body.npi } : {}),
      },
    })

    return NextResponse.json(doctor, { status: 201 })
  } catch (error) {
    console.error('POST /api/doctors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
