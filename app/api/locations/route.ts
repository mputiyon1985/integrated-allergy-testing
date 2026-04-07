import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const locations = await prisma.location.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(locations)
  } catch (error) {
    console.error('GET /api/locations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name?: string
      key?: string
      suite?: string
      street?: string
      city?: string
      state?: string
      zip?: string
    }

    const { name, key, street, city, state, zip } = body

    if (!name || !key || !street || !city || !state || !zip) {
      return NextResponse.json(
        { error: 'name, key, street, city, state, and zip are required' },
        { status: 400 }
      )
    }

    const location = await prisma.location.create({
      data: {
        name,
        key,
        suite: body.suite,
        street,
        city,
        state,
        zip,
      },
    })

    return NextResponse.json(location, { status: 201 })
  } catch (error) {
    console.error('POST /api/locations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
