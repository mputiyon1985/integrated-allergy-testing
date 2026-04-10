/**
 * @file /api/encounters/count — Fast encounter count for dashboard KPI
 * @description Returns a count of encounters for a given date (default: today).
 *   Much faster than fetching all encounters and filtering client-side.
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get('date') // YYYY-MM-DD
    const patientId = req.nextUrl.searchParams.get('patientId')
    const locationId = req.nextUrl.searchParams.get('locationId')

    // Build date range — default to today
    const targetDate = date ? new Date(date) : new Date()
    const start = new Date(targetDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(targetDate)
    end.setHours(23, 59, 59, 999)

    const startISO = start.toISOString()
    const endISO = end.toISOString()

    let sql = `SELECT COUNT(*) as count FROM Encounter
               WHERE deletedAt IS NULL
               AND encounterDate >= ? AND encounterDate <= ?`
    const values: unknown[] = [startISO, endISO]

    if (patientId) {
      sql += ' AND patientId=?'
      values.push(patientId)
    }
    if (locationId) {
      sql += ' AND locationId=?'
      values.push(locationId)
    }

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...values)
    const count = Number(rows[0]?.count ?? 0)

    return NextResponse.json({ count, date: start.toISOString().split('T')[0] }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('[EncountersCount] GET error:', err)
    return NextResponse.json({ count: 0 }, { status: 500 })
  }
}
