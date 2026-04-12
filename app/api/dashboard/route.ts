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

function todayRange(locParam?: string | null) {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const start = new Date(y, m, d, 0, 0, 0).toISOString()
  const end   = new Date(y, m, d, 23, 59, 59).toISOString()
  return { start, end }
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const locationId  = searchParams.get('locationId')
  const practiceId  = searchParams.get('practiceId')

  const locFilter   = locationId  ? `AND locationId = '${locationId}'`  : practiceId ? `AND practiceId = '${practiceId}'` : ''
  const locFilterAp = locationId  ? `AND a.locationId = '${locationId}'` : practiceId ? `AND a.practiceId = '${practiceId}'` : ''

  const today = new Date()
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
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
      // Today's appointments
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT a.id, a.title, a.patientId, a.startTime, a.endTime, a.status, a.type, a.notes,
                a.locationId, a.reasonId, a.createdBy, a.createdAt, a.updatedAt, a.deletedAt,
                p.firstName || ' ' || p.lastName AS patientName,
                ar.name AS reasonName,
                COALESCE(doc.name, a.createdBy) AS providerName
         FROM IatAppointment a
         LEFT JOIN Patient p ON p.id = a.patientId
         LEFT JOIN AppointmentReason ar ON ar.id = a.reasonId
         LEFT JOIN Doctor doc ON doc.locationId = a.locationId AND doc.active = 1
         WHERE a.deletedAt IS NULL
           AND a.startTime >= ? AND a.startTime <= ?
           ${locationId ? `AND a.locationId = ?` : practiceId ? `AND a.practiceId = ?` : ''}
         ORDER BY a.startTime ASC
         LIMIT 100`,
        ...[dayStart, dayEnd, ...(locationId ? [locationId] : practiceId ? [practiceId] : [])]
      ),

      // Waiting room
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT w.id, w.patientId, w.status, w.checkInTime, w.appointmentId, w.locationId,
                w.waitMinutes, w.inServiceMinutes, w.notes,
                p.firstName || ' ' || p.lastName AS patientName,
                ar.name AS reasonName
         FROM WaitingRoom w
         LEFT JOIN Patient p ON p.id = w.patientId
         LEFT JOIN IatAppointment a ON a.id = w.appointmentId
         LEFT JOIN AppointmentReason ar ON ar.id = a.reasonId
         WHERE w.status IN ('waiting','in-service')
           ${locationId ? `AND w.locationId = ?` : ''}
         ORDER BY w.checkInTime ASC`,
        ...(locationId ? [locationId] : [])
      ),

      // Encounter count for today
      prisma.$queryRawUnsafe<Array<{ cnt: number }>>(
        `SELECT COUNT(*) as cnt FROM Encounter
         WHERE encounterDate >= ? AND encounterDate <= ?
           ${locationId ? `AND locationId = ?` : ''}`,
        ...[dayStart, dayEnd, ...(locationId ? [locationId] : [])]
      ),

      // Patients (limited for booking modal)
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, firstName || ' ' || lastName AS name, firstName, lastName, dateOfBirth
         FROM Patient
         WHERE active = 1
           ${locationId ? `AND locationId = ?` : ''}
         ORDER BY firstName ASC LIMIT 200`,
        ...(locationId ? [locationId] : [])
      ),

      // Doctors
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, name, title, locationId, active FROM Doctor
         WHERE active = 1
           ${locationId ? `AND (locationId = ? OR locationId IS NULL)` : ''}
         ORDER BY name ASC`,
        ...(locationId ? [locationId] : [])
      ),

      // Nurses
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, name, title, locationId, active FROM Nurse
         WHERE active = 1
           ${locationId ? `AND (locationId = ? OR locationId IS NULL)` : ''}
         ORDER BY name ASC`,
        ...(locationId ? [locationId] : [])
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
