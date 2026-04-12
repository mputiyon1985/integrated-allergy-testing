/**
 * @file /api/dashboard — Combined dashboard data endpoint
 * @description Returns all dashboard data in a single request to avoid
 *              multiple cold-start penalties on Vercel serverless functions.
 * @security Requires authenticated session
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await verifySession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('locationId')
  const practiceId = searchParams.get('practiceId')

  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const dayStart = new Date(y, m, d, 0, 0, 0).toISOString()
  const dayEnd   = new Date(y, m, d, 23, 59, 59).toISOString()

  try {
    const [
      appointmentsRaw,
      waitingRaw,
      encounterCountRaw,
      patientsRaw,
      doctorsRaw,
      nursesRaw,
      reasonsRaw,
    ] = await Promise.all([

      // Today's appointments — IATAppointment has patientName + reasonName inline
      locationId
        ? prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT id, title, patientId, patientName, startTime, endTime, status, type,
                    notes, reasonId, reasonName, providerName, locationId, createdBy, createdAt, updatedAt, deletedAt
             FROM IATAppointment
             WHERE deletedAt IS NULL AND startTime >= ? AND startTime <= ? AND locationId = ?
             ORDER BY startTime ASC LIMIT 100`,
            dayStart, dayEnd, locationId
          )
        : prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT id, title, patientId, patientName, startTime, endTime, status, type,
                    notes, reasonId, reasonName, providerName, locationId, createdBy, createdAt, updatedAt, deletedAt
             FROM IATAppointment
             WHERE deletedAt IS NULL AND startTime >= ? AND startTime <= ?
             ORDER BY startTime ASC LIMIT 100`,
            dayStart, dayEnd
          ),

      // Waiting room — active entries only
      locationId
        ? prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT id, patientId, patientName, status, checkedInAt, calledAt,
                    nurseName, notes, videosWatched, locationId
             FROM WaitingRoom
             WHERE status IN ('waiting','in-service') AND locationId = ?
             ORDER BY checkedInAt ASC`,
            locationId
          )
        : prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT id, patientId, patientName, status, checkedInAt, calledAt,
                    nurseName, notes, videosWatched, locationId
             FROM WaitingRoom
             WHERE status IN ('waiting','in-service')
             ORDER BY checkedInAt ASC`
          ),

      // Encounter count for today
      locationId
        ? prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT COUNT(*) as cnt FROM Encounter
             WHERE encounterDate >= ? AND encounterDate <= ? AND locationId = ?`,
            dayStart, dayEnd, locationId
          )
        : prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT COUNT(*) as cnt FROM Encounter
             WHERE encounterDate >= ? AND encounterDate <= ?`,
            dayStart, dayEnd
          ),

      // Patients (for booking modal)
      locationId
        ? prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT id, firstName || ' ' || lastName AS name, firstName, lastName, dateOfBirth
             FROM Patient WHERE active = 1 AND locationId = ?
             ORDER BY firstName ASC LIMIT 200`,
            locationId
          )
        : prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT id, firstName || ' ' || lastName AS name, firstName, lastName, dateOfBirth
             FROM Patient WHERE active = 1
             ORDER BY firstName ASC LIMIT 200`
          ),

      // Doctors
      locationId
        ? prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT id, name, title, locationId, active FROM Doctor
             WHERE active = 1 AND (locationId = ? OR locationId IS NULL)
             ORDER BY name ASC`,
            locationId
          )
        : prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT id, name, title, locationId, active FROM Doctor
             WHERE active = 1 ORDER BY name ASC`
          ),

      // Nurses
      locationId
        ? prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT id, name, title, locationId, active FROM Nurse
             WHERE active = 1 AND (locationId = ? OR locationId IS NULL)
             ORDER BY name ASC`,
            locationId
          )
        : prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT id, name, title, locationId, active FROM Nurse
             WHERE active = 1 ORDER BY name ASC`
          ),

      // Appointment reasons
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, name, duration, color FROM AppointmentReason WHERE active = 1 ORDER BY name ASC`
      ),
    ])

    return NextResponse.json({
      appointments:   appointmentsRaw,
      waiting:        waitingRaw,
      encounterCount: Number((encounterCountRaw[0] as Record<string, unknown>)?.cnt ?? 0),
      patients:       patientsRaw,
      doctors:        doctorsRaw,
      nurses:         nursesRaw,
      reasons:        reasonsRaw,
    })
  } catch (err) {
    console.error('[/api/dashboard] error:', err)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
