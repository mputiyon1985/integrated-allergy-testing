/**
 * @file /api/full-seed — Comprehensive demo data seed
 * @description
 *   POST — Seeds every active location with:
 *     - 1 demo doctor
 *     - 3 demo nurses
 *     - 10 demo patients
 *     - Rolling appointments: today + next 13 days (weekdays only), 8/day
 *
 *   Idempotent: uses INSERT OR IGNORE with deterministic IDs.
 *   Secured by SEED_SECRET env var (must match Authorization: Bearer <secret>).
 *   If SEED_SECRET is not set, auth is skipped (dev mode).
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// ── Doctor name pool (cycles if > 14 locations) ─────────────────────────────
const DOCTOR_NAMES = [
  'Dr. Sarah Mitchell', 'Dr. James Okafor', 'Dr. Linda Zhao', 'Dr. Carlos Rivera',
  'Dr. Emily Watson',  'Dr. Priya Patel',   'Dr. Marcus Green', 'Dr. Alicia Torres',
  'Dr. Kevin Park',    'Dr. Rachel Chen',   'Dr. Thomas Bell',  'Dr. Aisha Johnson',
  'Dr. Nathan Brooks', 'Dr. Mei Lin',
]

// ── Nurse name sets (rotate by location index % 4) ──────────────────────────
const NURSE_SETS = [
  ['Jennifer Adams RN', 'Michael Torres LPN', 'Sophia Wright RN'],
  ['David Kim RN',      'Maria Santos LPN',   'Alex Johnson RN'],
  ['Patricia Moore RN', 'James Wilson LPN',   'Elena Vasquez RN'],
  ['Robert Clark RN',   'Diana Lee LPN',      'Samuel Brown RN'],
]

// ── Patient name pool (40 names, 10 per location slot) ──────────────────────
const PATIENT_POOL = [
  // Set 0 (locations[0])
  'Emma Harrison',   'Liam Foster',    'Olivia Hayes',    'Noah Campbell',  'Ava Mitchell',
  'Ethan Russell',   'Isabella Turner','Mason Reed',      'Sophia Barnes',  'Lucas Powell',
  // Set 1 (locations[1])
  'Charlotte Hughes','Aiden Butler',   'Mia Coleman',     'Jackson Griffin','Amelia Price',
  'Elijah Ross',     'Harper Jenkins', 'Logan Simmons',   'Evelyn Patterson','Sebastian Cox',
  // Set 2 (locations[2])
  'Abigail Howard',  'Benjamin Ward',  'Emily Ramirez',   'Alexander Wood', 'Elizabeth Torres',
  'Michael Peterson','Sofia Gray',     'Daniel James',    'Avery Watson',   'Matthew Brooks',
  // Set 3+ (locations[3] and beyond)
  'Madison Cook',    'Matthew Rogers', 'Scarlett Morgan', 'Jack Bell',      'Chloe Bailey',
  'Oliver Cooper',   'Zoey Richardson','Henry Cox',       'Lily Flores',    'Owen Rivera',
]

// ── Insurance providers (by patient index % 5) ──────────────────────────────
const INSURANCE = [
  'Blue Cross Blue Shield', 'Aetna', 'UnitedHealth', 'Cigna', 'Humana',
]

// ── Appointment time slots & reasons ────────────────────────────────────────
const APPT_SLOTS = [
  { h: 9,  m: 0  }, { h: 9,  m: 30 }, { h: 10, m: 0  }, { h: 10, m: 30 },
  { h: 13, m: 0  }, { h: 13, m: 30 }, { h: 14, m: 0  }, { h: 14, m: 30 },
]
const APPT_REASONS = [
  'Allergy Shot', 'Allergy Testing', 'Allergy Shot',    'New Patient Intake',
  'Allergy Shot', 'Follow-Up',       'Allergy Testing', 'Consultation',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function toIso(year: number, month: number, day: number, hour: number, min: number): string {
  // Store as UTC; offset +4 converts local US Eastern (EDT) to UTC
  return new Date(Date.UTC(year, month, day, hour + 4, min, 0)).toISOString()
}

function getWeekdays(startDate: Date, count: number): Date[] {
  const days: Date[] = []
  let current = new Date(startDate)
  let added = 0
  while (added < count) {
    const dow = current.getDay()
    if (dow !== 0 && dow !== 6) { // skip Sat/Sun
      days.push(new Date(current))
      added++
    }
    current.setDate(current.getDate() + 1)
  }
  return days
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth check — also accept a query param for one-time use
  const secret = process.env.SEED_SECRET
  const queryToken = request.nextUrl.searchParams.get('token') ?? ''

  if (!secret) {
    return NextResponse.json({ error: 'SEED_SECRET not configured — seed endpoint disabled' }, { status: 503 })
  }
  // Always require secret
  if (true) {
    const auth = request.headers.get('authorization') ?? ''
    const bearerToken = auth.startsWith('Bearer ') ? auth.slice(7) : auth
    if (bearerToken !== secret && queryToken !== secret) {
      // Debug: return secret length to help diagnose
      return NextResponse.json(
        { error: 'Unauthorized', hint: `secret_len=${secret.length}, got_len=${bearerToken.length}` },
        { status: 401 }
      )
    }
  }

  try {
    const now = new Date().toISOString()
    const today = new Date()

    // Fetch all active locations
    const locationRows = await prisma.$queryRaw<{ id: string; key: string; name: string }[]>`
      SELECT id, key, name FROM Location WHERE deletedAt IS NULL AND active = 1 ORDER BY name
    `

    if (!locationRows.length) {
      return NextResponse.json({ error: 'No active locations found' }, { status: 404 })
    }

    const weekdays = getWeekdays(today, 14)
    const summary: Record<string, { doctors: number; nurses: number; patients: number; appointments: number }> = {}

    for (let locIdx = 0; locIdx < locationRows.length; locIdx++) {
      const loc = locationRows[locIdx]
      const locKey = loc.key.toLowerCase()
      const counts = { doctors: 0, nurses: 0, patients: 0, appointments: 0 }

      // ── 1. Doctor ──────────────────────────────────────────────────────────
      const docId   = `demo-doc-${locKey}`
      const docName = DOCTOR_NAMES[locIdx % DOCTOR_NAMES.length]
      const docRows = await prisma.$executeRaw`
        INSERT OR IGNORE INTO Doctor (id, name, active, locationId, createdAt, updatedAt)
        VALUES (${docId}, ${docName}, 1, ${loc.id}, ${now}, ${now})
      `
      counts.doctors = Number(docRows)

      // ── 2. Nurses ──────────────────────────────────────────────────────────
      const nurseSet = NURSE_SETS[locIdx % NURSE_SETS.length]
      for (let n = 0; n < 3; n++) {
        const nurseId   = `demo-nurse-${locKey}-${n + 1}`
        const nurseName = nurseSet[n]
        const nr = await prisma.$executeRaw`
          INSERT OR IGNORE INTO Nurse (id, name, active, locationId, createdAt, updatedAt)
          VALUES (${nurseId}, ${nurseName}, 1, ${loc.id}, ${now}, ${now})
        `
        counts.nurses += Number(nr)
      }

      // ── 3. Patients ────────────────────────────────────────────────────────
      const patSetStart = (locIdx % 4) * 10
      const patientIds: Array<{ id: string; name: string }> = []

      for (let p = 0; p < 10; p++) {
        const patId     = `demo-pat-${locKey}-${String(p + 1).padStart(2, '0')}`
        const patReadId = `DEMO-${locKey.toUpperCase()}-${String(p + 1).padStart(2, '0')}`
        const patName   = PATIENT_POOL[(patSetStart + p) % PATIENT_POOL.length]
        const insurance = INSURANCE[p % INSURANCE.length]
        // Use a static demo DOB
        const dob = `198${(p % 10)}-0${(p % 9) + 1}-15T00:00:00.000Z`

        const pr = await prisma.$executeRaw`
          INSERT OR IGNORE INTO Patient
            (id, name, patientId, dob, status, locationId, doctorId,
             insuranceProvider, createdAt, updatedAt)
          VALUES
            (${patId}, ${patName}, ${patReadId}, ${dob}, 'registered',
             ${loc.id}, ${docId}, ${insurance}, ${now}, ${now})
        `
        counts.patients += Number(pr)
        patientIds.push({ id: patId, name: patName })
      }

      // ── 4. Rolling appointments ────────────────────────────────────────────
      for (const date of weekdays) {
        const y  = date.getFullYear()
        const mo = date.getMonth()
        const d  = date.getDate()
        const dateStr = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

        for (let s = 0; s < APPT_SLOTS.length; s++) {
          const slot   = APPT_SLOTS[s]
          const reason = APPT_REASONS[s]
          const pat    = patientIds[s % patientIds.length]
          const apptId = `demo-appt-${dateStr}-${s}-${locKey}`

          const startIso = toIso(y, mo, d, slot.h, slot.m)
          const endIso   = toIso(y, mo, d, slot.h, slot.m + 30)
          const title    = `${reason} — ${pat.name}`

          const ar = await prisma.$executeRaw`
            INSERT OR IGNORE INTO IATAppointment
              (id, title, patientId, patientName, reasonName,
               startTime, endTime, type, status, locationId, createdAt, updatedAt)
            VALUES
              (${apptId}, ${title}, ${pat.id}, ${pat.name}, ${reason},
               ${startIso}, ${endIso}, 'allergy-test', 'scheduled', ${loc.id}, ${now}, ${now})
          `
          counts.appointments += Number(ar)
        }
      }

      summary[loc.name] = counts
    }

    const totals = Object.values(summary).reduce(
      (acc, c) => ({
        doctors:      acc.doctors      + c.doctors,
        nurses:       acc.nurses       + c.nurses,
        patients:     acc.patients     + c.patients,
        appointments: acc.appointments + c.appointments,
      }),
      { doctors: 0, nurses: 0, patients: 0, appointments: 0 }
    )

    return NextResponse.json({
      ok: true,
      message: 'Full seed complete',
      locations: locationRows.length,
      totals,
      byLocation: summary,
    })
  } catch (error) {
    console.error('[api/full-seed:POST]', error)
    return NextResponse.json({ error: 'Full seed failed', detail: String(error) }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
