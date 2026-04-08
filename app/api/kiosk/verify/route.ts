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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { patientId?: string; firstName?: string };
    const { patientId, firstName } = body;

    if (!patientId || !firstName) {
      return NextResponse.json({ error: 'patientId and firstName are required' }, { status: 400 });
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
          name: patient.name,
        },
      },
      { headers: HIPAA_HEADERS }
    );
  } catch (error) {
    console.error('POST /api/kiosk/verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
