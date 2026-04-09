/**
 * @file /api/practices/[id] — Get or update a specific practice
 * @security Requires authenticated session; admin role enforced for PUT.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  shortName: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  fax: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  npi: z.string().max(20).optional(),
  taxId: z.string().max(30).optional(),
  logoUrl: z.string().optional(),
  active: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const practice = await prisma.practice.findUnique({
      where: { id },
      include: {
        locations: {
          where: { deletedAt: null },
          select: { id: true, name: true, key: true, active: true, city: true, state: true },
          orderBy: { name: 'asc' },
        },
      },
    })
    if (!practice) {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 })
    }
    return NextResponse.json({ practice })
  } catch (error) {
    console.error('GET /api/practices/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = req.headers.get('x-user-role')
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const result = updateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const practice = await prisma.practice.update({
      where: { id },
      data: result.data,
    })
    return NextResponse.json({ practice })
  } catch (error) {
    console.error('PUT /api/practices/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
