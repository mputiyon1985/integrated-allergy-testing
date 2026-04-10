export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get('search') ?? ''
    const all = req.nextUrl.searchParams.get('all') === 'true'
    const where = {
      ...(all ? {} : { active: true }),
      ...(search
        ? {
            OR: [
              { code: { contains: search } },
              { description: { contains: search } },
              { category: { contains: search } },
            ],
          }
        : {}),
    }

    const codes = await prisma.iCD10Code.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ codes })
  } catch (err) {
    console.error('[ICD10] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch ICD-10 codes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, 'icd10_manage')
  if (denied) return denied
  try {
    const body = await req.json()
    const { code, description, category, active, sortOrder } = body

    if (!code || !description) {
      return NextResponse.json({ error: 'code and description are required' }, { status: 400 })
    }

    const created = await prisma.iCD10Code.create({
      data: {
        code,
        description,
        category: category ?? null,
        active: active ?? true,
        sortOrder: sortOrder ?? 0,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    console.error('[ICD10] POST error:', err)
    return NextResponse.json({ error: 'Failed to create ICD-10 code' }, { status: 500 })
  }
}
