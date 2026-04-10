import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

function locFilter(locationId: string | null, practiceId: string | null): { sql: string; vals: unknown[] } {
  if (locationId) return { sql: ' AND e.locationId=?', vals: [locationId] }
  if (practiceId) return {
    sql: ' AND e.locationId IN (SELECT id FROM Location WHERE practiceId=? AND deletedAt IS NULL)',
    vals: [practiceId],
  }
  return { sql: '', vals: [] }
}

function locFilterAlias(
  alias: string,
  locationId: string | null,
  practiceId: string | null,
): { sql: string; vals: unknown[] } {
  if (locationId) return { sql: ` AND ${alias}.locationId=?`, vals: [locationId] }
  if (practiceId) return {
    sql: ` AND ${alias}.locationId IN (SELECT id FROM Location WHERE practiceId=? AND deletedAt IS NULL)`,
    vals: [practiceId],
  }
  return { sql: '', vals: [] }
}

// ── Clinical ────────────────────────────────────────────────────────────────
async function getClinical(
  from: string, to: string,
  locationId: string | null, practiceId: string | null,
  physicianName: string | null,
) {
  const loc = locFilter(locationId, practiceId)
  const base = [from, to, ...loc.vals]

  const dateWhere = ` WHERE e.deletedAt IS NULL AND date(e.encounterDate)>=? AND date(e.encounterDate)<=?${loc.sql}`
  const physFilter = physicianName ? ' AND e.doctorName=?' : ''
  const physVals = physicianName ? [physicianName] : []

  const [kpiRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN e.status='open' THEN 1 ELSE 0 END) as openCount,
        ROUND(AVG(CASE WHEN e.waitMinutes IS NOT NULL THEN e.waitMinutes END),1) as avgWait,
        ROUND(AVG(CASE WHEN e.inServiceMinutes IS NOT NULL THEN e.inServiceMinutes END),1) as avgInService
       FROM Encounter e${dateWhere}${physFilter}`,
      ...base, ...physVals,
    ),
  ])

  const byDay = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT date(e.encounterDate) as day,
       COUNT(*) as total,
       SUM(CASE WHEN e.status='open' THEN 1 ELSE 0 END) as openCount,
       SUM(CASE WHEN e.status IN ('signed','billed','complete') THEN 1 ELSE 0 END) as completeCount,
       ROUND(AVG(e.waitMinutes),1) as avgWait
     FROM Encounter e${dateWhere}${physFilter}
     GROUP BY day ORDER BY day DESC`,
    ...base, ...physVals,
  )

  const byPhysician = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT COALESCE(e.doctorName,'Unknown') as name,
       COUNT(*) as count,
       ROUND(AVG(e.waitMinutes),1) as avgWait,
       ROUND(AVG(e.inServiceMinutes),1) as avgInService
     FROM Encounter e${dateWhere}
     GROUP BY e.doctorName ORDER BY count DESC`,
    ...base,
  )

  const topComplaints = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT e.chiefComplaint as complaint, COUNT(*) as count
     FROM Encounter e${dateWhere}${physFilter}
     GROUP BY e.chiefComplaint ORDER BY count DESC LIMIT 10`,
    ...base, ...physVals,
  )

  const byDiagnosis = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT COALESCE(e.diagnosisCode,'—') as code, COUNT(*) as count
     FROM Encounter e${dateWhere}${physFilter}
     GROUP BY e.diagnosisCode ORDER BY count DESC LIMIT 20`,
    ...base, ...physVals,
  )

  return { kpi: kpiRows[0] ?? {}, byDay, byPhysician, topComplaints, byDiagnosis }
}

// ── Billing ─────────────────────────────────────────────────────────────────
async function getBilling(
  from: string, to: string,
  locationId: string | null, practiceId: string | null,
) {
  const loc = locFilter(locationId, practiceId)
  const base = [from, to, ...loc.vals]
  const dateWhere = ` WHERE e.deletedAt IS NULL AND date(e.encounterDate)>=? AND date(e.encounterDate)<=?${loc.sql}`

  const kpiRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT
       SUM(CASE WHEN e.status='signed'      THEN 1 ELSE 0 END) as signed,
       SUM(CASE WHEN e.status='billed'      THEN 1 ELSE 0 END) as billed,
       SUM(CASE WHEN e.status='awaiting_md' THEN 1 ELSE 0 END) as awaitingMd,
       COUNT(*) as total
     FROM Encounter e${dateWhere}`,
    ...base,
  )

  const statusSummary = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT e.status, COUNT(*) as count
     FROM Encounter e${dateWhere}
     GROUP BY e.status ORDER BY count DESC`,
    ...base,
  )

  const readyToBill = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT e.id, p.name as patientName, date(e.encounterDate) as date,
       COALESCE(e.doctorName,'—') as physician,
       COALESCE(e.diagnosisCode,'—') as diagnosisCode
     FROM Encounter e
     LEFT JOIN Patient p ON e.patientId = p.id
     WHERE e.deletedAt IS NULL AND e.status='signed'
       AND date(e.encounterDate)>=? AND date(e.encounterDate)<=?${loc.sql}
     ORDER BY e.encounterDate ASC LIMIT 100`,
    ...base,
  )

  const insuranceBreakdown = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT COALESCE(p.insuranceProvider,'Unknown') as provider, COUNT(DISTINCT e.id) as count
     FROM Encounter e
     LEFT JOIN Patient p ON e.patientId = p.id
     WHERE e.deletedAt IS NULL AND date(e.encounterDate)>=? AND date(e.encounterDate)<=?${loc.sql}
     GROUP BY p.insuranceProvider ORDER BY count DESC LIMIT 20`,
    ...base,
  )

  return { kpi: kpiRows[0] ?? {}, statusSummary, readyToBill, insuranceBreakdown }
}

// ── Staff ───────────────────────────────────────────────────────────────────
async function getStaff(
  from: string, to: string,
  locationId: string | null, practiceId: string | null,
) {
  const loc = locFilter(locationId, practiceId)
  const base = [from, to, ...loc.vals]
  const dateWhere = ` WHERE e.deletedAt IS NULL AND date(e.encounterDate)>=? AND date(e.encounterDate)<=?${loc.sql}`

  const byNurse = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT COALESCE(e.nurseName,'Unknown') as nurseName,
       COUNT(*) as count,
       ROUND(AVG(e.waitMinutes),1) as avgWait
     FROM Encounter e${dateWhere}
     GROUP BY e.nurseName ORDER BY count DESC`,
    ...base,
  )

  const byPhysician = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT COALESCE(e.doctorName,'Unknown') as doctorName,
       COUNT(*) as total,
       SUM(CASE WHEN e.status IN ('signed','billed') THEN 1 ELSE 0 END) as signedCount
     FROM Encounter e${dateWhere}
     GROUP BY e.doctorName ORDER BY total DESC`,
    ...base,
  )

  const loc2 = locFilterAlias('ea', locationId, practiceId)
  const actBase = [from, to, ...loc2.vals]
  const activityByType = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ea.type as activityType, COUNT(*) as count
     FROM EncounterActivity ea
     WHERE ea.deletedAt IS NULL
       AND date(ea.timestamp)>=? AND date(ea.timestamp)<=?${loc2.sql}
     GROUP BY ea.type ORDER BY count DESC`,
    ...actBase,
  )

  return { byNurse, byPhysician, activityByType }
}

// ── Testing ─────────────────────────────────────────────────────────────────
async function getTesting(from: string, to: string) {
  const base = [from, to]
  const dateWhere = ` WHERE t.deletedAt IS NULL AND date(t.testedAt)>=? AND date(t.testedAt)<=?`

  const kpiRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT COUNT(*) as total,
       SUM(CASE WHEN t.reaction>=2 THEN 1 ELSE 0 END) as positiveCount
     FROM AllergyTestResult t${dateWhere}`,
    ...base,
  )

  const byType = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT t.testType, COUNT(*) as count,
       SUM(CASE WHEN t.reaction>=2 THEN 1 ELSE 0 END) as positiveCount
     FROM AllergyTestResult t${dateWhere}
     GROUP BY t.testType ORDER BY count DESC`,
    ...base,
  )

  const topAllergens = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT a.name as allergen, COUNT(*) as tested,
       SUM(CASE WHEN t.reaction>=2 THEN 1 ELSE 0 END) as positiveCount
     FROM AllergyTestResult t
     LEFT JOIN Allergen a ON t.allergenId = a.id
     WHERE t.deletedAt IS NULL AND date(t.testedAt)>=? AND date(t.testedAt)<=?
     GROUP BY t.allergenId, a.name
     ORDER BY positiveCount DESC LIMIT 10`,
    ...base,
  )

  const byDay = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT date(t.testedAt) as day, COUNT(*) as count
     FROM AllergyTestResult t${dateWhere}
     GROUP BY day ORDER BY day DESC`,
    ...base,
  )

  return { kpi: kpiRows[0] ?? {}, byType, topAllergens, byDay }
}

// ── Handler ──────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const denied = await requirePermission(req, 'reports_view')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'clinical'
  const from = searchParams.get('from') ?? new Date().toISOString().slice(0, 10)
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0, 10)
  const locationId = searchParams.get('locationId') || null
  const practiceId = searchParams.get('practiceId') || null
  const physicianName = searchParams.get('physicianName') || null

  try {
    let data: Record<string, unknown> = {}
    if (type === 'clinical') data = await getClinical(from, to, locationId, practiceId, physicianName)
    else if (type === 'billing') data = await getBilling(from, to, locationId, practiceId)
    else if (type === 'staff') data = await getStaff(from, to, locationId, practiceId)
    else if (type === 'testing') data = await getTesting(from, to)

    return NextResponse.json({ type, from, to, ...data }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('[reports]', err)
    return NextResponse.json({ error: 'Failed to load report' }, { status: 500, headers: HIPAA_HEADERS })
  }
}
