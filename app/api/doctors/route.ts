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

    const doctors = await prisma.doctor.findMany({
      where: {
        deletedAt: null,
        ...(all ? {} : { active: true }),
      },
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
    const body = await request.json()

    const result = createDoctorSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { name, title, specialty, email, phone, clinicLocation } = result.data

    const doctor = await prisma.doctor.create({
      data: {
        name,
        ...(title ? { title } : {}),
        ...(specialty ? { specialty } : {}),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(clinicLocation ? { clinicLocation } : {}),
        ...(((body as { npi?: string }).npi) ? { npi: (body as { npi?: string }).npi } : {}),
      },
    })

    return NextResponse.json(doctor, { status: 201 })
  } catch (error) {
    console.error('POST /api/doctors error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
