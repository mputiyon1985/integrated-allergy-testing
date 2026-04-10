/**
 * @file /api/forms/pdf — PDF document generation for patient forms
 * @description Generates and streams PDF files for patient consent or test results.
 *   GET — Generate a PDF given ?patientId= and ?type= ('consent' | 'results').
 *         Consent PDFs include the patient's stored signature if available.
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { generateConsentPDF, generateTestResultsPDF } from '@/lib/pdf'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  const type = searchParams.get('type') // 'consent' | 'results'

  if (!patientId || !type) {
    return NextResponse.json({ error: 'patientId and type are required' }, { status: 400 })
  }

  if (!['consent', 'results'].includes(type)) {
    return NextResponse.json({ error: 'type must be consent or results' }, { status: 400 })
  }

  try {
    const patientRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM Patient WHERE (id = ? OR patientId = ?) LIMIT 1`, patientId, patientId
    )
    const patient = patientRows[0] ?? null

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Type helpers for raw query result
    const ptId = patient.id as string
    const ptPatientId = patient.patientId as string | null
    const ptName = patient.name as string
    const ptDob = patient.dob as string | null
    const ptEmail = patient.email as string | null

    // Parse name into firstName/lastName for PDF compatibility
    const [firstName, ...rest] = ptName.split(' ')
    const lastName = rest.join(' ')

    let pdfBlob: Blob
    let filename: string

    if (type === 'consent') {
      // Get the most recent signature if available
      const formActivity = await prisma.formActivity.findFirst({
        where: { patientId: ptId, signedAt: { not: null } },
        orderBy: { signedAt: 'desc' },
      })

      pdfBlob = generateConsentPDF(
        {
          firstName,
          lastName,
          dob: ptDob ? new Date(ptDob) : new Date(),
          email: ptEmail ?? undefined,
          patientId: ptPatientId ?? ptId,
        },
        formActivity?.signature ?? undefined
      )
      filename = `consent-${ptPatientId ?? ptId}.pdf`
    } else {
      // Fetch test results with raw SQL (AllergyTestResult has DateTime fields)
      const testResultRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT t.*, a.name as allergen_name FROM AllergyTestResult t
         LEFT JOIN Allergen a ON a.id = t.allergenId
         WHERE t.patientId = ? AND t.active = 1
         ORDER BY t.testedAt DESC`, ptId
      )

      const results = testResultRows.map((r) => ({
        allergenName: (r.allergen_name as string) ?? 'Unknown',
        testType: r.testType as string,
        reaction: r.reaction as number,
        wheal: r.wheal as string | null,
        testedAt: r.testedAt ? new Date(r.testedAt as string) : new Date(),
      }))

      pdfBlob = generateTestResultsPDF(
        {
          firstName,
          lastName,
          patientId: ptPatientId ?? ptId,
          dob: ptDob ? new Date(ptDob) : new Date(),
        },
        results
      )
      filename = `results-${ptPatientId ?? ptId}.pdf`
    }

    const arrayBuffer = await pdfBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await prisma.auditLog.create({
      data: {
        action: 'PDF_GENERATED',
        entity: 'Patient',
        entityId: ptId,
        patientId: ptId,
        details: `Generated ${type} PDF for patient ${ptPatientId}`,
      },
    })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        ...HIPAA_HEADERS,
      },
    })
  } catch (error) {
    console.error('GET /api/forms/pdf error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
