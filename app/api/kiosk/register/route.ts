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
      phone?: string;
      email?: string;
      street?: string;
      apt?: string;
      city?: string;
      state?: string;
      zip?: string;
      insuranceProvider?: string;
      insuranceId?: string;
      dob?: string;
    };
    const { firstName, lastName, dob } = body;

    if (!firstName || !lastName || !dob) {
      return NextResponse.json(
        { error: 'firstName, lastName, and dob are required' },
        { status: 400 }
      );
    }

    // Input length validation
    if (typeof firstName !== 'string' || firstName.trim().length < 1 || firstName.trim().length > 100) {
      return NextResponse.json({ error: 'firstName must be 1-100 characters' }, { status: 400 });
    }
    if (typeof lastName !== 'string' || lastName.trim().length < 1 || lastName.trim().length > 100) {
      return NextResponse.json({ error: 'lastName must be 1-100 characters' }, { status: 400 });
    }

    const dobDate = new Date(dob + 'T00:00:00.000Z');
    if (isNaN(dobDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Validate DOB is in a reasonable range (born 1900-present)
    const minDate = new Date('1900-01-01')
    const today = new Date()
    if (dobDate < minDate || dobDate > today) {
      return NextResponse.json({ error: 'Invalid date of birth' }, { status: 400 });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    // Use PA-XXXXXXXX nanoid format per architecture rules
    const { customAlphabet } = await import('nanoid');
    const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);
    const patientId = `PA-${nanoid()}`;
    const id = crypto.randomUUID();
    const nowStr = new Date().toISOString();
    const dobStr = dobDate.toISOString();

    await prisma.$executeRaw`INSERT INTO Patient (
        id, patientId, name, dob, phone, email, street, apt, city, state, zip,
        insuranceProvider, insuranceId, status,
        physician, clinicLocation, diagnosis, startDate,
        createdAt, updatedAt
      ) VALUES (
        ${id}, ${patientId}, ${fullName}, ${dobStr},
        ${body.phone?.trim() || null}, ${body.email?.trim() || null},
        ${body.street?.trim() || null}, ${body.apt?.trim() || null},
        ${body.city?.trim() || null}, ${body.state?.trim() || null}, ${body.zip?.trim() || null},
        ${body.insuranceProvider?.trim() || null}, ${body.insuranceId?.trim() || null},
        'active',
        '', '', '', ${nowStr},
        ${nowStr}, ${nowStr}
      )`;

    const patient = { id, patientId, name: fullName, dob: dobStr };

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
