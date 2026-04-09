export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const all = req.nextUrl.searchParams.get('all') === 'true'
    const type = req.nextUrl.searchParams.get('type') ?? ''

    const where: Record<string, unknown> = {
      ...(all ? {} : { active: true }),
      ...(type ? { type } : {}),
    }

    const companies = await prisma.insuranceCompany.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ companies })
  } catch (err) {
    console.error('[InsuranceCompanies] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch insurance companies' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, type, payerId, phone, fax, website, planTypes, notes, active, sortOrder } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const created = await prisma.insuranceCompany.create({
      data: {
        name,
        type: type ?? 'commercial',
        payerId: payerId ?? null,
        phone: phone ?? null,
        fax: fax ?? null,
        website: website ?? null,
        planTypes: planTypes ?? null,
        notes: notes ?? null,
        active: active ?? true,
        sortOrder: sortOrder ?? 0,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    console.error('[InsuranceCompanies] POST error:', err)
    return NextResponse.json({ error: 'Failed to create insurance company' }, { status: 500 })
  }
}
