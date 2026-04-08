/**
 * @file /api/kiosk/videos-watched — Query which videos a patient has completed
 * @description
 *   GET — Returns an array of videoIds the patient has marked completed.
 *   Used by the verify step to determine if the patient can skip the videos screen.
 *   No auth required — kiosk-facing endpoint.
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

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
    return NextResponse.json({ watchedIds: activities.map(a => a.videoId) }, { headers: HIPAA_HEADERS })
  } catch {
    return NextResponse.json({ watchedIds: [] })
  }
}
