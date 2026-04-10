export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/api-permissions';
import { createId } from '@paralleldrive/cuid2';

const DAY_COUNT = 7;

function defaultHours(practiceId: string) {
  return Array.from({ length: DAY_COUNT }, (_, i) => ({
    id: createId(),
    practiceId,
    dayOfWeek: i,
    isOpen: i >= 1 && i <= 5 ? 1 : 0,
    openTime: '08:00',
    closeTime: '17:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    notes: '',
  }));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requirePermission(req, 'practices_manage');
  if (authError) return authError;

  const { id } = await params;

  try {
    const rows = await prisma.$queryRaw<Array<{
      id: string; practiceId: string; dayOfWeek: number;
      isOpen: number; openTime: string; closeTime: string;
      lunchStart: string | null; lunchEnd: string | null; notes: string | null;
    }>>`SELECT * FROM PracticeHours WHERE practiceId = ${id} ORDER BY dayOfWeek`;

    const hours = rows.length > 0 ? rows : defaultHours(id);
    return NextResponse.json({ hours });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requirePermission(req, 'practices_manage');
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json() as {
    hours: Array<{
      dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string;
      lunchStart?: string | null; lunchEnd?: string | null; notes?: string;
    }>;
  };

  if (!body.hours || !Array.isArray(body.hours)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    for (const h of body.hours) {
      const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM PracticeHours WHERE practiceId = ${id} AND dayOfWeek = ${h.dayOfWeek}
      `;

      const isOpen = h.isOpen ? 1 : 0;
      const lunchStart = h.lunchStart || null;
      const lunchEnd = h.lunchEnd || null;
      const notes = h.notes || '';
      const now = new Date().toISOString();

      if (existing.length > 0) {
        await prisma.$executeRaw`
          UPDATE PracticeHours
          SET isOpen = ${isOpen}, openTime = ${h.openTime}, closeTime = ${h.closeTime},
              lunchStart = ${lunchStart}, lunchEnd = ${lunchEnd},
              notes = ${notes}, updatedAt = ${now}
          WHERE practiceId = ${id} AND dayOfWeek = ${h.dayOfWeek}
        `;
      } else {
        const newId = createId();
        await prisma.$executeRaw`
          INSERT INTO PracticeHours
            (id, practiceId, dayOfWeek, isOpen, openTime, closeTime, lunchStart, lunchEnd, notes, createdAt, updatedAt)
          VALUES
            (${newId}, ${id}, ${h.dayOfWeek}, ${isOpen}, ${h.openTime}, ${h.closeTime},
             ${lunchStart}, ${lunchEnd}, ${notes}, ${now}, ${now})
        `;
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
