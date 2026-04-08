/**
 * @file /api/locations — Clinical location management
 * @description Manages clinic/office locations used for doctor and patient assignments.
 *   GET  — List all active locations sorted by name.
 *   POST — Create a new location (name, key, street, city, state, zip required).
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  key: z.string().min(1).max(50).regex(/^[A-Z0-9-]+$/, 'Key must be uppercase alphanumeric'),
  suite: z.string().max(50).optional(),
  street: z.string().min(1).max(300),
  city: z.string().min(1).max(100),
  state: z.string().length(2, 'State must be 2 letters').toUpperCase(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === '1'

    const locations = await prisma.location.findMany({
      where: {
        deletedAt: null,
        ...(all ? {} : { active: true }),
      },
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
    const body = await request.json()

    const result = createLocationSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { name, key, suite, street, city, state, zip } = result.data

    const location = await prisma.location.create({
      data: {
        name,
        key,
        suite,
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
