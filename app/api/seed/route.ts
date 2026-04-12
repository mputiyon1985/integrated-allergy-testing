/**
 * @file /api/seed — Rolling appointment seed for demo/production
 * @description
 *   POST — Seeds appointments for today + next 14 days (weekdays only) for all
 *          active locations. Uses rolling dates so the demo always has current data.
 *          Idempotent: uses INSERT OR IGNORE so safe to call repeatedly.
 *   Secured by SEED_SECRET env var (must match Authorization: Bearer <secret>)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// Core hardcoded demo patients (always available before full-seed runs)
const FALLBACK_PATIENTS = [
  { id: 'pat-iat-001', name: 'James Thompson' },
  { id: 'pat-iat-002', name: 'Maria Rodriguez' },
  { id: 'pat-iat-003', name: 'Linda Chen' },
  { id: 'pat-iat-004', name: 'David Patel' },
  { id: 'pat-iat-005', name: 'Sarah Williams' },
  { id: 'pat-iat-006', name: 'Michael Brown' },
  { id: 'pat-iat-007', name: 'Mark Putiyon' },
]

const APPOINTMENT_TEMPLATES = [
  { hour: 9,  min: 0,  duration: 30, reasonName: 'Allergy Shot',              pi: 0 },
  { hour: 9,  min: 30, duration: 45, reasonName: 'Allergy Testing',           pi: 1 },
  { hour: 10, min: 0,  duration: 30, reasonName: 'Allergy Shot',              pi: 2 },
  { hour: 10, min: 30, duration: 60, reasonName: 'New Patient Intake',        pi: 3 },
  { hour: 11, min: 0,  duration: 30, reasonName: 'Allergy Shot',              pi: 4 },
  { hour: 11, min: 30, duration: 45, reasonName: 'Immunotherapy Build-Up',    pi: 5 },
  { hour: 13, min: 0,  duration: 30, reasonName: 'Allergy Shot',              pi: 6 },
  { hour: 13, min: 30, duration: 45, reasonName: 'Follow-Up',                 pi: 0 },
  { hour: 14, min: 0,  duration: 60, reasonName: 'Allergy Testing',           pi: 1 },
  { hour: 14, min: 30, duration: 30, reasonName: 'Immunotherapy Maintenance', pi: 2 },
  { hour: 15, min: 0,  duration: 30, reasonName: 'Allergy Shot',              pi: 3 },
  { hour: 15, min: 30, duration: 45, reasonName: 'Consultation',              pi: 4 },
  { hour: 16, min: 0,  duration: 30, reasonName: 'Allergy Shot',              pi: 5 },
]

function makeId(dateStr: string, idx: number, locId: string) {
  return `demo-${dateStr}-${idx}-${locId.slice(-3)}`
}

function toIso(year: number, month: number, day: number, hour: number, min: number) {
  // EDT = UTC-4 (April); convert local hour to UTC
  return new Date(Date.UTC(year, month, day, hour + 4, min, 0)).toISOString()
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
    const daysToSeed = 14 // seed today + next 13 days (weekdays only)
    let inserted = 0
    let skipped = 0

    // Fetch all active locations dynamically
    const locationRows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM Location WHERE deletedAt IS NULL AND active = 1
    `
    const LOCATION_IDS = locationRows.map(r => r.id)

    // Fetch all demo patients (from full-seed) plus fallback hardcoded patients
    let corePatients = FALLBACK_PATIENTS
    try {
      const dbDemoPatients = await prisma.$queryRaw<{ id: string; name: string }[]>`
        SELECT id, name FROM Patient WHERE id LIKE 'demo-pat-%' AND deletedAt IS NULL
      `
      if (dbDemoPatients.length > 0) {
        // Merge: db demo patients first, then fallback for any gaps
        const seen = new Set(dbDemoPatients.map(p => p.id))
        corePatients = [
          ...dbDemoPatients,
          ...FALLBACK_PATIENTS.filter(p => !seen.has(p.id)),
        ]
      }
    } catch {
      // If Patient table query fails, fall through to hardcoded list
    }

    for (let d = 0; d < daysToSeed; d++) {
      const date = new Date(today)
      date.setDate(today.getDate() + d)
      const y   = date.getFullYear()
      const m   = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${day}`

      // Skip weekends for realistic demo data
      const dow = date.getDay()
      if (dow === 0 || dow === 6) continue

      for (const loc of LOCATION_IDS) {
        for (let i = 0; i < APPOINTMENT_TEMPLATES.length; i++) {
          const tmpl   = APPOINTMENT_TEMPLATES[i]
          const patient = corePatients[tmpl.pi % corePatients.length]
          const id     = makeId(dateStr, i, loc)
          const [y2, mo, d2] = dateStr.split('-').map(Number)
          const startTime = toIso(y2, mo - 1, d2, tmpl.hour, tmpl.min)
          const endMin    = tmpl.min + tmpl.duration
          const endTime   = toIso(y2, mo - 1, d2, tmpl.hour + Math.floor(endMin / 60), endMin % 60)
          const title     = `${tmpl.reasonName} — ${patient.name}`

          try {
            await prisma.$executeRaw`
              INSERT OR IGNORE INTO IATAppointment
                (id, title, patientId, patientName, reasonName, startTime, endTime,
                 type, status, locationId, createdAt, updatedAt)
              VALUES
                (${id}, ${title}, ${patient.id}, ${patient.name}, ${tmpl.reasonName},
                 ${startTime}, ${endTime}, 'allergy-test', 'scheduled', ${loc}, ${now}, ${now})
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
      message: 'Seed complete',
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
