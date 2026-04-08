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
    const { code, description, category, active, sortOrder } = body

    const updated = await prisma.iCD10Code.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(active !== undefined && { active }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[ICD10] PUT error:', err)
    return NextResponse.json({ error: 'Failed to update ICD-10 code' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.iCD10Code.update({
      where: { id },
      data: { active: false },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[ICD10] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to deactivate ICD-10 code' }, { status: 500 })
  }
}
