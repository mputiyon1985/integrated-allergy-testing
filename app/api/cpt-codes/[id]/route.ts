import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { code, description, category, defaultFee, active, sortOrder } = body

    const updated = await prisma.cPTCode.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(defaultFee !== undefined && { defaultFee }),
        ...(active !== undefined && { active }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[CPT] PUT error:', err)
    return NextResponse.json({ error: 'Failed to update CPT code' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.cPTCode.update({
      where: { id },
      data: { active: false },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[CPT] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to deactivate CPT code' }, { status: 500 })
  }
}
