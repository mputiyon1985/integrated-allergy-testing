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

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { dob?: string };
    const { dob } = body;

    // Rate limiting: max 10 DOB lookups per IP per 60 seconds
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentCount = await prisma.auditLog.count({
      where: {
        action: 'Kiosk DOB Lookup',
        details: ip,
        createdAt: { gte: windowStart },
      },
    });

    // Log this attempt (IP only — never log the DOB)
    await prisma.auditLog.create({
      data: {
        action: 'Kiosk DOB Lookup',
        entity: 'Patient',
        details: ip,
      },
    }).catch(() => { /* non-blocking */ });

    if (recentCount >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: HIPAA_HEADERS }
      );
    }

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

    const patients = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; dob: string }>>(
      `SELECT id, name, dob FROM Patient WHERE deletedAt IS NULL AND dob >= ? AND dob <= ?`,
      dayBefore.toISOString(), dayAfter.toISOString()
    );

    if (patients.length === 0) {
      return NextResponse.json({ found: false }, { headers: HIPAA_HEADERS });
    }

    // Return minimal info — only first name for privacy (no last name, no DOB)
    const safePatients = patients.map(p => ({
      id: p.id,
      firstName: p.name.split(' ')[0],
      // DOB intentionally omitted — it was used only for lookup, not returned
    }));

    return NextResponse.json(
      { found: true, patients: safePatients },
      { headers: HIPAA_HEADERS }
    );
  } catch (error) {
    console.error('POST /api/kiosk/lookup error:', error);
        prisma.auditLog.create({ data: {
      action: 'KIOSK_LOOKUP',
      entity: 'Patient',
      entityId: 'kiosk',
      details: 'Patient lookup performed via kiosk',
    }}).catch(() => {})
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
