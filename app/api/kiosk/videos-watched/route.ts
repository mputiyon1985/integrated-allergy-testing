import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ watchedIds: [] })

  try {
    const activities = await prisma.videoActivity.findMany({
      where: { patientId, completed: true },
      select: { videoId: true },
    })
    return NextResponse.json({ watchedIds: activities.map(a => a.videoId) })
  } catch {
    return NextResponse.json({ watchedIds: [] })
  }
}
