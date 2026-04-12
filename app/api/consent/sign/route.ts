/**
 * @file /api/consent/sign — Record a patient's consent form signature
 * @description
 *   POST — Creates a ConsentRecord with the patient's signature (base64 PNG).
 *   Also creates an audit log entry for HIPAA compliance.
 *   Kiosk-facing endpoint; requires patientId and formId.
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export const dynamic = 'force-dynamic'

const VALID_CONSENT_FORM_IDS = ['form-consent-001', 'form-consent-002']
const MAX_SIGNATURE_BYTES = 500_000 // ~375KB base64-encoded PNG — reject absurdly large payloads

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patientId, formId, signature, userAgent } = body

    if (!patientId || !formId) {
      return NextResponse.json({ error: 'patientId and formId are required' }, { status: 400 })
    }

    // Validate formId is a known consent form — prevents spoofed formIds
    if (!VALID_CONSENT_FORM_IDS.includes(formId)) {
      return NextResponse.json({ error: 'Invalid formId' }, { status: 400 })
    }

    // Validate patientId exists
    const patientRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM Patient WHERE id = ? AND deletedAt IS NULL LIMIT 1`, patientId
    )
    const patient = patientRows[0] ?? null
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Limit signature size to prevent DoS via enormous base64 payloads
    if (signature && typeof signature === 'string' && signature.length > MAX_SIGNATURE_BYTES) {
      return NextResponse.json({ error: 'Signature data too large' }, { status: 413 })
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

    // Fire-and-forget: record encounter activity
    fetch(`${req.nextUrl.origin}/api/encounter-activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, type: 'consent_signed', linkedConsentId: record.id, notes: `Signed: ${formId}`, performedBy: 'Patient (Kiosk)' }),
    }).catch((e: unknown) => console.error('[audit]', e))

    await prisma.auditLog.create({
      data: {
        action: 'CONSENT_SIGNED',
        entity: 'ConsentRecord',
        entityId: record.id,
        patientId,
        details: `Consent signed for formId: ${formId}`,
      },
    }).catch(() => { /* non-blocking */ })

    return NextResponse.json({ ok: true, recordId: record.id }, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('Consent sign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
