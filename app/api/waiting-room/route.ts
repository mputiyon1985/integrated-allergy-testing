import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const entries = await prisma.waitingRoom.findMany({
      where: { status: { in: ['waiting', 'in-service'] } },
      orderBy: { checkedInAt: 'asc' },
    })
    return NextResponse.json({ entries })
  } catch (err) {
    console.error('GET /api/waiting-room error:', err)
    return NextResponse.json({ entries: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { patientId: string; patientName: string; notes?: string }
    const entry = await prisma.waitingRoom.create({
      data: {
        patientId: body.patientId,
        patientName: body.patientName,
        notes: body.notes,
        status: 'waiting',
      },
    })
    return NextResponse.json({ entry }, { status: 201 })
  } catch (err) {
    console.error('POST /api/waiting-room error:', err)
    return NextResponse.json({ error: 'Failed to add to waiting room' }, { status: 500 })
  }
}
