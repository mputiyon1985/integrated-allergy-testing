export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const updated = await prisma.billingRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(insuranceType !== undefined && { insuranceType }),
        ...(ruleType !== undefined && { ruleType }),
        ...(cptCode !== undefined && { cptCode }),
        ...(relatedCptCode !== undefined && { relatedCptCode }),
        ...(maxUnits !== undefined && { maxUnits }),
        ...(requiresModifier !== undefined && { requiresModifier }),
        ...(requiresDxMatch !== undefined && { requiresDxMatch }),
        ...(warningMessage !== undefined && { warningMessage }),
        ...(active !== undefined && { active }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[BillingRules] PUT error:', err)
    return NextResponse.json({ error: 'Failed to update billing rule' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Soft delete — set active = false
    const updated = await prisma.billingRule.update({
      where: { id },
      data: { active: false },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[BillingRules] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to deactivate billing rule' }, { status: 500 })
  }
}
