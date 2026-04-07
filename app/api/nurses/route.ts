/**
 * @file /api/nurses — Nurse directory
 * @description
 *   GET  — List nurses. Pass ?all=1 to include inactive.
 *   POST — Create a new nurse record (name required).
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

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
    const body = await request.json() as {
      name?: string
      title?: string
      email?: string
      phone?: string
      clinicLocation?: string
      npi?: string
    }

    const { name } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const nurse = await prisma.nurse.create({
      data: {
        name,
        ...(body.title ? { title: body.title } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.clinicLocation ? { clinicLocation: body.clinicLocation } : {}),
        ...(body.npi ? { npi: body.npi } : {}),
      },
    })

    return NextResponse.json(nurse, { status: 201 })
  } catch (error) {
    console.error('POST /api/nurses error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
