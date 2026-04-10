/**
 * @file /api/iat-appointments — Appointment booking for IAT calendar
 * @description
 *   GET  ?date=YYYY-MM-DD — returns all appointments for that date's week (Mon-Sun),
 *                           or current week if no date supplied.
 *   POST — create new appointment.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  title: z.string().min(1).max(200),
  patientId: z.string().optional(),
  patientName: z.string().max(200).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  type: z.string().optional(),
  notes: z.string().max(1000).optional(),
  createdBy: z.string().max(200).optional(),
})

function getWeekRange(date: Date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMon)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
  const end   = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const rangeParam = searchParams.get('range') // 'week' | 'month'
    const locationId = searchParams.get('locationId')
    const practiceId = searchParams.get('practiceId')
    const base = dateParam ? new Date(dateParam) : new Date()

    const { start, end } = rangeParam === 'month'
      ? getMonthRange(base)
      : getWeekRange(base)

    const startStr = start.toISOString()
    const endStr = end.toISOString()

    let appointments
    if (locationId) {
      appointments = await prisma.$queryRaw`
        SELECT * FROM IatAppointment
        WHERE deletedAt IS NULL
          AND startTime >= ${startStr}
          AND startTime <= ${endStr}
          AND locationId = ${locationId}
        ORDER BY startTime ASC
      `
    } else if (practiceId) {
      appointments = await prisma.$queryRaw`
        SELECT * FROM IatAppointment
        WHERE deletedAt IS NULL
          AND startTime >= ${startStr}
          AND startTime <= ${endStr}
          AND locationId IN (SELECT id FROM Location WHERE practiceId = ${practiceId} AND deletedAt IS NULL)
        ORDER BY startTime ASC
      `
    } else {
      appointments = await prisma.$queryRaw`
        SELECT * FROM IatAppointment
        WHERE deletedAt IS NULL
          AND startTime >= ${startStr}
          AND startTime <= ${endStr}
        ORDER BY startTime ASC
      `
    }

    return NextResponse.json(appointments)
  } catch (error) {
    console.error('GET /api/iat-appointments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await requirePermission(request, 'appointments_create')
  if (denied) return denied
  try {
    const body = await request.json()
    const result = createSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { title, patientId, patientName, startTime, endTime, type, notes, createdBy } = result.data

    // Validate time order
    if (new Date(startTime) >= new Date(endTime)) {
      return NextResponse.json({ error: 'endTime must be after startTime' }, { status: 400 })
    }

    const appointment = await prisma.iATAppointment.create({
      data: {
        title,
        patientId: patientId || '',
        patientName: patientName ?? null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        type: type ?? 'allergy-test',
        notes: notes ?? null,
        createdBy: createdBy ?? null,
      },
    })

    // Fire-and-forget: record encounter activity (only when patientId is present)
    if (appointment.patientId) {
      fetch(`${request.nextUrl.origin}/api/encounter-activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: appointment.patientId, type: 'appointment_scheduled', linkedAppointmentId: appointment.id, notes: `Booked: ${appointment.title}`, performedBy: 'Staff' }),
      }).catch(() => {})
    }

    prisma.auditLog.create({
      data: {
        action: 'APPOINTMENT_CREATED',
        entity: 'IATAppointment',
        entityId: appointment.id,
        patientId: appointment.patientId || null,
        details: `Appointment: ${appointment.title} at ${appointment.startTime}`,
      },
    }).catch(() => {})

    return NextResponse.json(appointment, { status: 201 })
  } catch (error) {
    console.error('POST /api/iat-appointments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
