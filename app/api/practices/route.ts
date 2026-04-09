/**
 * @file /api/practices — Practice management
 * @description
 *   GET  — List all practices (admin only).
 *   POST — Create a new practice (admin only).
 * @security Requires authenticated session; admin role enforced for write ops.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  key: z.string().max(20).optional(),
  shortName: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  fax: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  npi: z.string().max(20).optional(),
  taxId: z.string().max(30).optional(),
  logoUrl: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const practices = await prisma.practice.findMany({
      where: { active: true },
      include: {
        locations: {
          where: { deletedAt: null },
          select: { id: true, name: true, key: true, active: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ practices })
  } catch (error) {
    console.error('GET /api/practices error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role')
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const result = createSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const practice = await prisma.practice.create({ data: result.data })
    return NextResponse.json({ practice }, { status: 201 })
  } catch (error) {
    console.error('POST /api/practices error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
