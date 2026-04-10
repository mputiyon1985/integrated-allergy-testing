import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

const SHOTS_ALLOWED_ROLES = ['admin', 'provider', 'clinical_staff', 'office_manager']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const shots = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM MaintenanceShot WHERE vialId = ? ORDER BY givenAt DESC LIMIT 50`,
      id
    )
    return NextResponse.json({ shots })
  } catch (error) {
    console.error('GET shots error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userRole = req.headers.get('x-user-role') ?? ''
  if (!SHOTS_ALLOWED_ROLES.includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id: vialId } = await params
    const body = await req.json()
    const {
      patientId,
      doseGiven = 0.4,
      arm = 'Left',
      reaction = 0,
      reactionNotes,
      givenBy,
      givenAt,
      waitMinutes = 20,
      intervalWeeks = 4,
    } = body

    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    const shotId = `ms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const givenAtDate = givenAt ? new Date(givenAt) : new Date()
    const givenAtStr = givenAtDate.toISOString()

    // Calculate next due date
    const nextDue = new Date(givenAtDate)
    nextDue.setDate(nextDue.getDate() + intervalWeeks * 7)
    const nextDueStr = nextDue.toISOString()

    await prisma.$executeRawUnsafe(
      `INSERT INTO MaintenanceShot (id, vialId, patientId, doseGiven, arm, reaction, reactionNotes, givenBy, givenAt, waitMinutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      shotId, vialId, patientId, doseGiven, arm, reaction,
      reactionNotes ?? null, givenBy ?? null, givenAtStr, waitMinutes
    )

    // Update vial's lastShotDate and nextDueDate
    await prisma.$executeRawUnsafe(
      `UPDATE MaintenanceVial SET lastShotDate = ?, nextDueDate = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      givenAtStr, nextDueStr, vialId
    )

    return NextResponse.json({ id: shotId, nextDueDate: nextDueStr }, { status: 201 })
  } catch (error) {
    console.error('POST shots error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
