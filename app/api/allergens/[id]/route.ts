import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json() as { showOnTestingScreen?: boolean; showOnPrickTest?: boolean; showOnIntradermalTest?: boolean; name?: string; type?: string; deletedAt?: string | null }

    const updated = await prisma.allergen.update({
      where: { id },
      data: {
        ...(body.showOnTestingScreen !== undefined && { showOnTestingScreen: body.showOnTestingScreen }),
        ...(body.showOnPrickTest !== undefined && { showOnPrickTest: body.showOnPrickTest }),
        ...(body.showOnIntradermalTest !== undefined && { showOnIntradermalTest: body.showOnIntradermalTest }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.type !== undefined && { type: body.type }),
        // null = restore, string = soft-delete, undefined = no change
        ...('deletedAt' in body && { deletedAt: body.deletedAt ? new Date(body.deletedAt) : null }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[Allergens] PUT error:', err)
    return NextResponse.json({ error: 'Failed to update allergen' }, { status: 500 })
  }
}
