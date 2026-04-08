/**
 * @file /api/nurses — Nurse directory
 * @description
 *   GET  — List nurses. Pass ?all=1 to include inactive.
 *   POST — Create a new nurse record (name required).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

const createNurseSchema = z.object({
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

    const nurses = await prisma.nurse.findMany({
      where: {
        deletedAt: null,
        ...(all ? {} : { active: true }),
      },
      orderBy: [{ name: 'asc' }],
    })

    return NextResponse.json(nurses)
  } catch (error) {
    console.error('GET /api/nurses error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const result = createNurseSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { name, title, email, phone, clinicLocation } = result.data

    const nurse = await prisma.nurse.create({
      data: {
        name,
        ...(title ? { title } : {}),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(clinicLocation ? { clinicLocation } : {}),
        ...(((body as { npi?: string }).npi) ? { npi: (body as { npi?: string }).npi } : {}),
      },
    })

    return NextResponse.json(nurse, { status: 201 })
  } catch (error) {
    console.error('POST /api/nurses error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
