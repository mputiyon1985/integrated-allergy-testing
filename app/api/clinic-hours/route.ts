/**
 * @file /api/clinic-hours — Clinic hours of operation
 * @description GET returns hours for all days. PUT updates a specific day.
 *   Used by the calendar to block bookings outside operating hours.
 * @security Requires authenticated session
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export const dynamic = 'force-dynamic'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday'
}

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<{ key: string; value: string }[]>`
      SELECT key, value FROM Settings WHERE key LIKE 'clinic_hours_%' OR key = 'clinic_appointment_duration'
    `
    const hours: Record<string, { label: string; hours: string; open: boolean; start?: string; end?: string }> = {}
    let appointmentDuration = 30

    for (const row of rows) {
      if (row.key === 'clinic_appointment_duration') {
        appointmentDuration = parseInt(row.value) || 30
        continue
      }
      const day = row.key.replace('clinic_hours_', '')
      const isOpen = row.value !== 'closed'
      const [start, end] = isOpen ? row.value.split('-') : [undefined, undefined]
      hours[day] = { label: DAY_LABELS[day] || day, hours: row.value, open: isOpen, start, end }
    }

    // Fill missing days with defaults
    for (const day of DAYS) {
      if (!hours[day]) {
        hours[day] = { label: DAY_LABELS[day] || day, hours: 'closed', open: false }
      }
    }

    return NextResponse.json({ hours, appointmentDuration }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('GET /api/clinic-hours error:', err)
    return NextResponse.json({ error: 'Failed to load hours' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as { day: string; hours: string }
    const { day, hours } = body

    if (!DAYS.includes(day)) {
      return NextResponse.json({ error: 'Invalid day' }, { status: 400 })
    }

    // Validate format: HH:MM-HH:MM or "closed"
    if (hours !== 'closed' && !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(hours)) {
      return NextResponse.json({ error: 'Invalid format. Use HH:MM-HH:MM or "closed"' }, { status: 400 })
    }

    await prisma.$executeRaw`
      INSERT INTO Settings (key, value) VALUES (${`clinic_hours_${day}`}, ${hours})
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PUT /api/clinic-hours error:', err)
    return NextResponse.json({ error: 'Failed to update hours' }, { status: 500 })
  }
}
