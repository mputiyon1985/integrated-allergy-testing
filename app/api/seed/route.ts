/**
 * @file /api/seed — Rolling appointment seed for demo/production
 * @description
 *   POST — Seeds appointments for today + next 7 days for all locations.
 *          Uses rolling dates so the demo always has current data.
 *          Idempotent: uses INSERT OR IGNORE so safe to call repeatedly.
 *   Secured by SEED_SECRET env var (must match Authorization: Bearer <secret>)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

const APPOINTMENT_TEMPLATES = [
  { hour: 9,  min: 0,  duration: 30, title: 'Allergy Shot — Putiyon',       reasonName: 'Allergy Shot',             type: 'allergy-shot' },
  { hour: 9,  min: 30, duration: 45, title: 'Allergy Testing — Thompson',    reasonName: 'Allergy Testing',          type: 'allergy-testing' },
  { hour: 10, min: 0,  duration: 30, title: 'Allergy Shot — Rodriguez',      reasonName: 'Allergy Shot',             type: 'allergy-shot' },
  { hour: 10, min: 30, duration: 60, title: 'New Patient Intake — Chen',     reasonName: 'New Patient Intake',       type: 'new-patient' },
  { hour: 11, min: 0,  duration: 30, title: 'Allergy Shot — Williams',       reasonName: 'Allergy Shot',             type: 'allergy-shot' },
  { hour: 11, min: 30, duration: 45, title: 'Immunotherapy Build-Up — Patel',reasonName: 'Immunotherapy Build-Up',   type: 'immunotherapy' },
  { hour: 13, min: 0,  duration: 30, title: 'Allergy Shot — Brown',          reasonName: 'Allergy Shot',             type: 'allergy-shot' },
  { hour: 13, min: 30, duration: 45, title: 'Follow-Up — Kim Putiyon',       reasonName: 'Follow-Up',                type: 'follow-up' },
  { hour: 14, min: 0,  duration: 60, title: 'Allergy Testing — Smith',       reasonName: 'Allergy Testing',          type: 'allergy-testing' },
  { hour: 14, min: 30, duration: 30, title: 'Immunotherapy Maintenance — Thompson', reasonName: 'Immunotherapy Maintenance', type: 'immunotherapy' },
  { hour: 15, min: 0,  duration: 30, title: 'Allergy Shot — Mark Putiyon',   reasonName: 'Allergy Shot',             type: 'allergy-shot' },
  { hour: 15, min: 30, duration: 45, title: 'Consultation — Jane Smith',     reasonName: 'Consultation',             type: 'consultation' },
  { hour: 16, min: 0,  duration: 30, title: 'Allergy Shot — Bob Pople',      reasonName: 'Allergy Shot',             type: 'allergy-shot' },
  { hour: 16, min: 30, duration: 45, title: 'Test Results Review — Rodriguez',reasonName: 'Test Results Review',     type: 'follow-up' },
]

// Locations to seed appointments for
const LOCATION_IDS = [
  'loc-iat-001',
  'loc-map-002',
]

function makeId(prefix: string, dateStr: string, hour: number, locId: string) {
  return `seed-${prefix}-${dateStr}-${hour}-${locId.slice(-3)}`
}

function toIso(dateStr: string, hour: number, min: number) {
  // dateStr is YYYY-MM-DD, treat as local Eastern time offset
  // Store as UTC: EDT is UTC-4, EST is UTC-5
  const offsetHours = 4 // EDT (April)
  const utcHour = hour + offsetHours
  const d = new Date(`${dateStr}T${String(utcHour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00.000Z`)
  return d.toISOString()
}

export async function POST(request: NextRequest) {
  // Auth check
  const secret = process.env.SEED_SECRET
  if (secret) {
    const auth = request.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const now = new Date().toISOString()
    const today = new Date()
    const daysToSeed = 7 // seed today + next 6 days
    let inserted = 0
    let skipped = 0

    for (let d = 0; d < daysToSeed; d++) {
      const date = new Date(today)
      date.setDate(today.getDate() + d)
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${day}`

      // Skip weekends for realistic demo data
      const dow = date.getDay()
      if (dow === 0 || dow === 6) continue

      for (const loc of LOCATION_IDS) {
        for (const tmpl of APPOINTMENT_TEMPLATES) {
          const id = makeId('appt', dateStr, tmpl.hour, loc)
          const startTime = toIso(dateStr, tmpl.hour, tmpl.min)
          const endTime = toIso(dateStr, tmpl.hour, tmpl.min + tmpl.duration)

          try {
            await prisma.$executeRaw`
              INSERT OR IGNORE INTO IatAppointment
                (id, title, reasonName, startTime, endTime, type, status, locationId, createdAt, updatedAt)
              VALUES
                (${id}, ${tmpl.title}, ${tmpl.reasonName}, ${startTime}, ${endTime},
                 ${tmpl.type}, 'scheduled', ${loc}, ${now}, ${now})
            `
            inserted++
          } catch {
            skipped++
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Seed complete`,
      inserted,
      skipped,
      daysSeeded: daysToSeed,
      locations: LOCATION_IDS.length,
    })
  } catch (error) {
    console.error('[api/seed:POST]', error)
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 })
  }
}

// Allow GET for easy browser/cron trigger (still checks secret if set)
export async function GET(request: NextRequest) {
  return POST(request)
}
