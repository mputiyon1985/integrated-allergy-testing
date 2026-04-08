import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patientId, formId, signature, userAgent } = body

    if (!patientId || !formId) {
      return NextResponse.json({ error: 'patientId and formId are required' }, { status: 400 })
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      undefined

    const record = await prisma.consentRecord.create({
      data: {
        patientId,
        formId,
        signature: signature || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || req.headers.get('user-agent') || null,
        version: '1.0',
      },
    })

    return NextResponse.json({ ok: true, recordId: record.id })
  } catch (error) {
    console.error('Consent sign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
