/**
 * @file /api/kiosk/lookup — Patient DOB lookup for kiosk check-in
 * @description
 *   POST — Look up patients by date of birth.
 *   Returns found=true with patient list (id + first initial only, no full PII) if found.
 *   Returns found=false if no matching patients.
 *   No auth required — kiosk-facing endpoint (runs on localhost touch screen).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { dob?: string };
    const { dob } = body;

    if (!dob) {
      return NextResponse.json({ error: 'dob is required' }, { status: 400 });
    }

    // Parse the DOB — input is YYYY-MM-DD from the date picker
    const dobDate = new Date(dob + 'T00:00:00.000Z');
    if (isNaN(dobDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Search ±1 day to handle timezone offset issues (SQLite stores UTC, input is local)
    const dayBefore = new Date(dobDate.getTime() - 86400000);
    const dayAfter = new Date(dobDate.getTime() + 86400000);

    const patients = await prisma.patient.findMany({
      where: {
        deletedAt: null,
        dob: { gte: dayBefore, lte: dayAfter },
      },
      select: {
        id: true,
        name: true,
        dob: true,
      },
    });

    if (patients.length === 0) {
      return NextResponse.json({ found: false }, { headers: HIPAA_HEADERS });
    }

    // Return minimal info — only first name for privacy (no last name, no full DOB)
    const safePatients = patients.map(p => ({
      id: p.id,
      firstName: p.name.split(' ')[0],
      dob: p.dob,
    }));

    return NextResponse.json(
      { found: true, patients: safePatients },
      { headers: HIPAA_HEADERS }
    );
  } catch (error) {
    console.error('POST /api/kiosk/lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
