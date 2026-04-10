/**
 * @file /api/encounters/[id]/claim — Claim generation from signed encounter
 * @description
 *   POST — Generates a claim summary JSON from a signed/billed encounter.
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { verifySession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

interface CPTEntry {
  code: string
  description: string
  units: number
  fee: number
  total: number
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: HIPAA_HEADERS })
  }

  try {
    const { id } = await params

    const encounterRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "Encounter" WHERE id=? AND deletedAt IS NULL`, id
    )
    if (!encounterRows.length) {
      return NextResponse.json({ error: 'Encounter not found' }, { status: 404, headers: HIPAA_HEADERS })
    }
    const encounter = encounterRows[0]

    if (encounter.status !== 'signed' && encounter.status !== 'billed') {
      return NextResponse.json({ error: 'Claim can only be generated for signed or billed encounters' }, { status: 400, headers: HIPAA_HEADERS })
    }

    const patientRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "Patient" WHERE id=? AND deletedAt IS NULL`, encounter.patientId as string
    )
    if (!patientRows.length) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404, headers: HIPAA_HEADERS })
    }
    const patient = patientRows[0]

    // Parse CPT summary
    let cptCodes: CPTEntry[] = []
    if (encounter.cptSummary) {
      try { cptCodes = JSON.parse(encounter.cptSummary as string) } catch { /* ignore */ }
    }

    // Calculate total charges
    const totalCharges = cptCodes.reduce((sum, c) => sum + (c.total ?? 0), 0)

    // Build diagnosis codes array
    const diagnosisCodes: string[] = []
    if (encounter.diagnosisCode) diagnosisCodes.push(encounter.diagnosisCode as string)

    // Generate claim ID
    const claimId = `CLM-${Date.now().toString(36).toUpperCase().slice(-6)}`

    // Format DOB
    const dob = patient.dob
      ? new Date(patient.dob as string).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      : ''

    // Format date of service
    const dateOfService = encounter.encounterDate
      ? new Date(encounter.encounterDate as string).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      : ''

    // Provider name
    const doctorName = encounter.doctorName as string | undefined
    const renderingProvider = doctorName
      ? (doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`)
      : 'Dr. —'

    const patientDisplayId = (patient.patientId as string | undefined) ?? (patient.id as string).slice(0, 8).toUpperCase()

    const claim = {
      claimId,
      encounterId: id,
      patientName: patient.name as string,
      patientId: patientDisplayId,
      dob,
      insuranceProvider: (patient.insuranceProvider as string | undefined) ?? '—',
      memberId: (patient.insuranceId as string | undefined) ?? '—',
      groupNumber: (patient.insuranceGroup as string | undefined) ?? '—',
      dateOfService,
      renderingProvider,
      renderingProviderNPI: '1234567890',
      diagnosisCodes,
      cptCodes,
      totalCharges: Math.round(totalCharges * 100) / 100,
      placeOfService: '11',
      claimGeneratedAt: new Date().toISOString(),
      status: 'ready',
    }

    return NextResponse.json(claim, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('POST /api/encounters/[id]/claim error:', err)
    return NextResponse.json({ error: 'Claim generation failed' }, { status: 500, headers: HIPAA_HEADERS })
  }
}
