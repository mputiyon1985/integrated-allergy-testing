/**
 * @file /api/encounters/[id]/cpt — Auto-calculate CPT codes from encounter activities
 * POST — calculates CPT based on test results and maintenance shots on the same day
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'
export const dynamic = 'force-dynamic'

interface CPTRow {
  code: string
  description: string
  defaultFee: number | null
}

interface CPTEntry {
  code: string
  description: string
  units: number
  fee: number
  total: number
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, 'encounters_edit')
  if (denied) return denied

  try {
    const { id } = await params

    const encounterRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "Encounter" WHERE id=? AND deletedAt IS NULL`, id
    )
    if (!encounterRows.length) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
    const encounter = encounterRows[0]
    const patientId = encounter.patientId as string
    const encounterDate = encounter.encounterDate as string | number

    // Build date range: same calendar day as encounter
    const encDate = new Date(encounterDate)
    const startOfDay = new Date(encDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(encDate)
    endOfDay.setHours(23, 59, 59, 999)

    const startISO = startOfDay.toISOString()
    const endISO = endOfDay.toISOString()

    // Count prick tests (scratch) with positive reaction (>= 1)
    const prickRows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM "AllergyTestResult"
       WHERE patientId=? AND testType='scratch' AND reaction >= 1
       AND createdAt >= ? AND createdAt <= ?`,
      patientId, startISO, endISO
    )
    const prickCount = Number(prickRows[0]?.cnt ?? 0)

    // Count intradermal tests with positive reaction (>= 1)
    const idRows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM "AllergyTestResult"
       WHERE patientId=? AND testType='intradermal' AND reaction >= 1
       AND createdAt >= ? AND createdAt <= ?`,
      patientId, startISO, endISO
    )
    const intradermalCount = Number(idRows[0]?.cnt ?? 0)

    // Count maintenance shots today
    const shotRows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM "MaintenanceShot"
       WHERE patientId=? AND givenAt >= ? AND givenAt <= ?`,
      patientId, startISO, endISO
    )
    const maintenanceShots = Number(shotRows[0]?.cnt ?? 0)

    // Build CPT code list based on AAAAI rules
    const cptCodesToFetch: { code: string; units: number }[] = []

    if (prickCount > 0) {
      cptCodesToFetch.push({ code: '95004', units: prickCount })
    }
    if (intradermalCount > 0) {
      cptCodesToFetch.push({ code: '95024', units: intradermalCount })
    }
    if (maintenanceShots === 1) {
      cptCodesToFetch.push({ code: '95115', units: 1 })
    } else if (maintenanceShots >= 2) {
      cptCodesToFetch.push({ code: '95117', units: 1 })
    }

    // If no test-based CPT, add E&M code based on complexity (default 99213)
    if (cptCodesToFetch.length === 0) {
      cptCodesToFetch.push({ code: '99213', units: 1 })
    }

    // Fetch fees from CPTCode table
    const codes = cptCodesToFetch.map(c => c.code)
    const placeholders = codes.map(() => '?').join(',')
    const feeRows = await prisma.$queryRawUnsafe<CPTRow[]>(
      `SELECT code, description, defaultFee FROM "CPTCode" WHERE code IN (${placeholders})`,
      ...codes
    )
    const feeMap: Record<string, { description: string; fee: number }> = {}
    for (const row of feeRows) {
      feeMap[row.code] = { description: row.description, fee: Number(row.defaultFee ?? 0) }
    }

    const cptCodes: CPTEntry[] = cptCodesToFetch.map(item => {
      const info = feeMap[item.code] ?? { description: item.code, fee: 0 }
      return {
        code: item.code,
        description: info.description,
        units: item.units,
        fee: info.fee,
        total: info.fee * item.units,
      }
    })

    const grandTotal = cptCodes.reduce((sum, c) => sum + c.total, 0)

    // Save cptSummary to encounter
    await prisma.$executeRawUnsafe(
      `UPDATE "Encounter" SET cptSummary=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      JSON.stringify(cptCodes), id
    )

    return NextResponse.json({
      cptCodes,
      grandTotal,
      summary: {
        prickCount,
        intradermalCount,
        maintenanceShots,
      }
    }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('[cpt]', err)
    return NextResponse.json({ error: 'Failed to calculate CPT codes' }, { status: 500 })
  }
}
