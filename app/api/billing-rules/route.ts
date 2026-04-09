export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const insuranceType = req.nextUrl.searchParams.get('insuranceType') ?? ''
    const all = req.nextUrl.searchParams.get('all') === 'true'

    const where: Record<string, unknown> = {
      ...(all ? {} : { active: true }),
    }

    if (insuranceType) {
      where.insuranceType = insuranceType
    }

    const rules = await prisma.billingRule.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ rules })
  } catch (err) {
    console.error('[BillingRules] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch billing rules' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name,
      description,
      insuranceType,
      ruleType,
      cptCode,
      relatedCptCode,
      maxUnits,
      requiresModifier,
      requiresDxMatch,
      warningMessage,
      active,
      sortOrder,
    } = body

    if (!name || !ruleType || !warningMessage) {
      return NextResponse.json(
        { error: 'name, ruleType, and warningMessage are required' },
        { status: 400 }
      )
    }

    const created = await prisma.billingRule.create({
      data: {
        name,
        description: description ?? '',
        insuranceType: insuranceType ?? 'all',
        ruleType,
        cptCode: cptCode ?? null,
        relatedCptCode: relatedCptCode ?? null,
        maxUnits: maxUnits ?? null,
        requiresModifier: requiresModifier ?? null,
        requiresDxMatch: requiresDxMatch ?? false,
        warningMessage,
        active: active ?? true,
        sortOrder: sortOrder ?? 0,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    console.error('[BillingRules] POST error:', err)
    return NextResponse.json({ error: 'Failed to create billing rule' }, { status: 500 })
  }
}
