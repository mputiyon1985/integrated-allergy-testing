import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json() as {
      reaction?: number
      wheal?: string
      notes?: string
      readAt?: string
    }

    const { reaction, wheal, notes, readAt } = body

    const testResult = await prisma.allergyTestResult.update({
      where: { id },
      data: {
        ...(reaction !== undefined ? { reaction } : {}),
        ...(wheal !== undefined ? { wheal } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(readAt !== undefined ? { readAt: new Date(readAt) } : {}),
      },
      include: { allergen: true },
    })

    return NextResponse.json(testResult)
  } catch (error) {
    console.error('PUT /api/test-results/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
