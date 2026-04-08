/**
 * @file /api/kiosk/register — Register a new patient via kiosk
 * @description
 *   POST — Creates a new patient record from the kiosk self-registration wizard.
 *   Requires firstName, lastName, and dob.
 *   No auth required — kiosk-facing endpoint.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      firstName?: string;
      lastName?: string;
      dob?: string;
    };
    const { firstName, lastName, dob } = body;

    if (!firstName || !lastName || !dob) {
      return NextResponse.json(
        { error: 'firstName, lastName, and dob are required' },
        { status: 400 }
      );
    }

    const dobDate = new Date(dob + 'T00:00:00.000Z');
    if (isNaN(dobDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const patientId = `PAT-${Date.now().toString(36).toUpperCase()}`;

    const patient = await prisma.patient.create({
      data: {
        patientId,
        name: fullName,
        dob: dobDate,
      },
      select: {
        id: true,
        patientId: true,
        name: true,
        dob: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'KIOSK_REGISTER',
        entity: 'Patient',
        entityId: patient.id,
        patientId: patient.id,
        details: `New patient self-registered via kiosk: ${patientId} — ${fullName}`,
      },
    }).catch(() => { /* non-blocking */ });

    return NextResponse.json(
      {
        patient: {
          id: patient.id,
          patientId: patient.patientId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: patient.name,
          dob: patient.dob,
        },
      },
      { status: 201, headers: HIPAA_HEADERS }
    );
  } catch (error) {
    console.error('POST /api/kiosk/register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
