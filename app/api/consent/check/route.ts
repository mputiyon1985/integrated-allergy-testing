import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

const CONSENT_FORMS = [
  { formId: 'form-consent-001', name: 'Patient Consent for Allergy Testing' },
  { formId: 'form-consent-002', name: 'Authorization for Release of Medical Information' },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')

  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
  }

  try {
    const records = await prisma.consentRecord.findMany({
      where: {
        patientId,
        formId: { in: CONSENT_FORMS.map(f => f.formId) },
      },
      orderBy: { signedAt: 'desc' },
    })

    const forms = CONSENT_FORMS.map(f => {
      const record = records.find((r: { formId: string; signedAt: Date }) => r.formId === f.formId)
      return {
        formId: f.formId,
        name: f.name,
        signed: !!record,
        signedAt: record?.signedAt?.toISOString(),
      }
    })

    const allSigned = forms.every(f => f.signed)

    return NextResponse.json({ allSigned, forms }, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('Consent check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
