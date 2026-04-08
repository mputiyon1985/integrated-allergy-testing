/**
 * @file /api/kiosk/verify — Verify patient identity by first name
 * @description
 *   POST — Verifies a patient's identity by comparing the entered first name
 *   against the stored name (case-insensitive).
 *   No auth required — kiosk-facing endpoint.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders';

export const dynamic = 'force-dynamic';

const VERIFY_RATE_LIMIT_MAX = 5;
const VERIFY_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { patientId?: string; firstName?: string };
    const { patientId, firstName } = body;

    if (!patientId || !firstName) {
      return NextResponse.json({ error: 'patientId and firstName are required' }, { status: 400 });
    }

    // Rate limit verify attempts per IP to prevent name enumeration
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const windowStart = new Date(Date.now() - VERIFY_RATE_LIMIT_WINDOW_MS);
    const recentCount = await prisma.auditLog.count({
      where: {
        action: 'KIOSK_VERIFY_ATTEMPT',
        details: ip,
        createdAt: { gte: windowStart },
      },
    });

    // Log this attempt
    await prisma.auditLog.create({
      data: {
        action: 'KIOSK_VERIFY_ATTEMPT',
        entity: 'Patient',
        details: ip,
      },
    }).catch(() => { /* non-blocking */ });

    if (recentCount >= VERIFY_RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait before trying again.' },
        { status: 429, headers: HIPAA_HEADERS }
      );
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, deletedAt: null },
      select: { id: true, name: true, patientId: true },
    });

    if (!patient) {
      return NextResponse.json({ verified: false, error: 'Patient not found' }, { headers: HIPAA_HEADERS });
    }

    // Case-insensitive first-name match
    const storedFirstName = patient.name.split(' ')[0].toLowerCase().trim();
    const enteredFirstName = firstName.toLowerCase().trim();

    if (storedFirstName !== enteredFirstName) {
      return NextResponse.json({ verified: false }, { headers: HIPAA_HEADERS });
    }

    // Log the kiosk check-in
    await prisma.auditLog.create({
      data: {
        action: 'KIOSK_CHECKIN',
        entity: 'Patient',
        entityId: patient.id,
        patientId: patient.id,
        details: `Kiosk identity verified for patient ${patient.patientId}`,
      },
    }).catch(() => { /* non-blocking */ });

    return NextResponse.json(
      {
        verified: true,
        patient: {
          id: patient.id,
          patientId: patient.patientId,
          firstName: patient.name.split(' ')[0],
          // Full name intentionally omitted from kiosk response — first name only for privacy
        },
      },
      { headers: HIPAA_HEADERS }
    );
  } catch (error) {
    console.error('POST /api/kiosk/verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
