export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(req, 'insurance_manage')
  if (denied) return denied
  try {
    const { id } = await params
    const body = await req.json()
    const { name, type, payerId, phone, fax, website, planTypes, notes, active, sortOrder } = body

    const updated = await prisma.insuranceCompany.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(payerId !== undefined && { payerId }),
        ...(phone !== undefined && { phone }),
        ...(fax !== undefined && { fax }),
        ...(website !== undefined && { website }),
        ...(planTypes !== undefined && { planTypes }),
        ...(notes !== undefined && { notes }),
        ...(active !== undefined && { active }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[InsuranceCompanies] PUT error:', err)
    return NextResponse.json({ error: 'Failed to update insurance company' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(req, 'insurance_manage')
  if (denied) return denied
  try {
    const { id } = await params

    const updated = await prisma.insuranceCompany.update({
      where: { id },
      data: { active: false },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[InsuranceCompanies] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to deactivate insurance company' }, { status: 500 })
  }
}
