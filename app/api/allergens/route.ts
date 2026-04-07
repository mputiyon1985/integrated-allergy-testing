import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const allergens = await prisma.allergen.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(allergens)
  } catch (error) {
    console.error('GET /api/allergens error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { name?: string; category?: string }
    const { name, category } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const allergen = await prisma.allergen.create({
      data: { name, category },
    })

    return NextResponse.json(allergen, { status: 201 })
  } catch (error) {
    console.error('POST /api/allergens error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
