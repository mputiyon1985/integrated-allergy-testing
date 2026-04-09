import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const vials = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT 
        mv.id, mv.patientId, mv.vialMode, mv.label, mv.currentDose, mv.maxDose,
        mv.concentration, mv.intervalWeeks, mv.lastShotDate, mv.nextDueDate,
        mv.expiresAt, mv.active, mv.notes, mv.createdAt,
        p.name as patientName, p.patientId as patientCode, p.status as patientStatus,
        p.clinicLocation
      FROM MaintenanceVial mv
      JOIN Patient p ON mv.patientId = p.id
      WHERE mv.active = 1 AND p.deletedAt IS NULL
      ORDER BY mv.nextDueDate ASC
    `)
    return NextResponse.json({ vials })
  } catch (error) {
    console.error('GET /api/maintenance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      patientId,
      vialMode = 'single',
      label = 'Set A',
      currentDose = 0.4,
      maxDose = 0.5,
      concentration = '1:1',
      intervalWeeks = 4,
      expiresAt,
      notes,
    } = body

    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    const id = `mv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await prisma.$executeRawUnsafe(
      `INSERT INTO MaintenanceVial (id, patientId, vialMode, label, currentDose, maxDose, concentration, intervalWeeks, expiresAt, notes, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      id, patientId, vialMode, label, currentDose, maxDose, concentration, intervalWeeks,
      expiresAt ?? null, notes ?? null
    )
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/maintenance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
