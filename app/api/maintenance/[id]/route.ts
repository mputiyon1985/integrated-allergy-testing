import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const allowed = ['label', 'currentDose', 'maxDose', 'concentration', 'intervalWeeks', 'nextDueDate', 'lastShotDate', 'expiresAt', 'notes', 'active', 'vialMode']
    const sets: string[] = []
    const vals: unknown[] = []

    for (const key of allowed) {
      if (key in body) {
        sets.push(`"${key}" = ?`)
        vals.push(body[key] ?? null)
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    sets.push(`"updatedAt" = CURRENT_TIMESTAMP`)
    vals.push(id)

    await prisma.$executeRawUnsafe(
      `UPDATE MaintenanceVial SET ${sets.join(', ')} WHERE id = ?`,
      ...vals
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/maintenance/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.$executeRawUnsafe(
      `UPDATE MaintenanceVial SET active = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      id
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/maintenance/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
