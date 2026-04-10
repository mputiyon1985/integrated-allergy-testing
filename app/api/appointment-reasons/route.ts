/**
 * @file /api/appointment-reasons — Appointment reason/type management
 * @description Manages the list of appointment reasons (Shot, Testing, Intake etc.)
 *   GET — list all active reasons ordered by sortOrder
 *   POST — create new reason
 * @security Requires authenticated session
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const all = searchParams.get('all') === 'true'
    const reasons = await prisma.appointmentReason.findMany({
      where: all ? undefined : { active: true },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json({ reasons })
  } catch (err) {
    console.error('GET /api/appointment-reasons error:', err)
    return NextResponse.json({ reasons: [] })
  }
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, 'settings_manage')
  if (denied) return denied
  try {
    const body = await req.json() as { name: string; color?: string; duration?: number; sortOrder?: number; active?: boolean }
    if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    
    const maxOrder = await prisma.appointmentReason.aggregate({ _max: { sortOrder: true } })
    const reason = await prisma.appointmentReason.create({
      data: {
        name: body.name.trim(),
        color: body.color || '#0d9488',
        duration: body.duration ?? 30,
        active: body.active !== undefined ? body.active : true,
        sortOrder: body.sortOrder !== undefined ? body.sortOrder : (maxOrder._max.sortOrder || 0) + 1,
      },
    })
    return NextResponse.json({ reason }, { status: 201 })
  } catch (err) {
    console.error('POST /api/appointment-reasons error:', err)
    return NextResponse.json({ error: 'Failed to create reason' }, { status: 500 })
  }
}
