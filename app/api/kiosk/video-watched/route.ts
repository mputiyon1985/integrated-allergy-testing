/**
 * @file /api/kiosk/video-watched — Record video completion from kiosk
 * @description
 *   POST — Records that a patient watched a video during kiosk check-in.
 *   Creates a VideoActivity record (upsert by patientId+videoId).
 *   No auth required — kiosk-facing endpoint.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      patientId?: string;
      videoId?: string;
      completed?: boolean;
    };
    const { patientId, videoId, completed = true } = body;

    if (!patientId || !videoId) {
      return NextResponse.json({ error: 'patientId and videoId are required' }, { status: 400 });
    }

    // Upsert: if they already have an activity record, update it; otherwise create
    const existing = await prisma.videoActivity.findFirst({
      where: { patientId, videoId },
    });

    let activity;
    if (existing) {
      activity = await prisma.videoActivity.update({
        where: { id: existing.id },
        data: { completed, watchedAt: new Date() },
      });
    } else {
      activity = await prisma.videoActivity.create({
        data: { patientId, videoId, completed, watchedAt: new Date() },
      });
    }

    return NextResponse.json({ success: true, activity }, { headers: HIPAA_HEADERS });
  } catch (error) {
    console.error('POST /api/kiosk/video-watched error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
