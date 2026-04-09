import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json() as { showOnTestingScreen?: boolean; name?: string; type?: string }

    const updated = await prisma.allergen.update({
      where: { id },
      data: {
        ...(body.showOnTestingScreen !== undefined && { showOnTestingScreen: body.showOnTestingScreen }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.type !== undefined && { type: body.type }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[Allergens] PUT error:', err)
    return NextResponse.json({ error: 'Failed to update allergen' }, { status: 500 })
  }
}
