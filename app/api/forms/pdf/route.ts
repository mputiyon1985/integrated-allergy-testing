import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { generateConsentPDF, generateTestResultsPDF } from '@/lib/pdf'

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
    const patient = await prisma.patient.findFirst({
      where: {
        OR: [{ id: patientId }, { patientId }],
        active: true,
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    let pdfBlob: Blob
    let filename: string

    if (type === 'consent') {
      // Get the most recent signature if available
      const formActivity = await prisma.formActivity.findFirst({
        where: { patientId: patient.id, signedAt: { not: null } },
        orderBy: { signedAt: 'desc' },
      })

      pdfBlob = generateConsentPDF(
        {
          firstName: patient.firstName,
          lastName: patient.lastName,
          honorific: patient.honorific,
          dob: patient.dob,
          email: patient.email,
          patientId: patient.patientId,
        },
        formActivity?.signature ?? undefined
      )
      filename = `consent-${patient.patientId}.pdf`
    } else {
      // Fetch test results
      const testResults = await prisma.allergyTestResult.findMany({
        where: { patientId: patient.id, active: true },
        include: { allergen: true },
        orderBy: { testedAt: 'desc' },
      })

      const results = testResults.map((r) => ({
        allergenName: r.allergen.name,
        testType: r.testType,
        reaction: r.reaction,
        wheal: r.wheal,
        testedAt: r.testedAt,
      }))

      pdfBlob = generateTestResultsPDF(
        {
          firstName: patient.firstName,
          lastName: patient.lastName,
          honorific: patient.honorific,
          patientId: patient.patientId,
          dob: patient.dob,
        },
        results
      )
      filename = `results-${patient.patientId}.pdf`
    }

    const arrayBuffer = await pdfBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (error) {
    console.error('GET /api/forms/pdf error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
