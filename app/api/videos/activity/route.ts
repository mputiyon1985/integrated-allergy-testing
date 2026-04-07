/**
 * @file /api/videos/activity — Patient video watch activity tracking
 * @description Records video interactions (watched, completed, acknowledged) for a patient.
 *   POST — Create a video activity record (patientId and videoId required).
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      patientId?: string
      videoId?: string
      completed?: boolean
      acknowledged?: boolean
    }

    const { patientId, videoId } = body

    if (!patientId || !videoId) {
      return NextResponse.json(
        { error: 'patientId and videoId are required' },
        { status: 400 }
      )
    }

    const activity = await prisma.videoActivity.create({
      data: {
        patientId,
        videoId,
        completed: body.completed ?? false,
        acknowledged: body.acknowledged ?? false,
      },
      include: {
        video: true,
        patient: {
          select: {
            id: true,
            patientId: true,
            name: true,
          },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        action: 'VIDEO_ACTIVITY',
        entity: 'VideoActivity',
        entityId: activity.id,
        patientId,
        details: `Patient ${patientId} watched video ${videoId}; completed=${activity.completed}; acknowledged=${activity.acknowledged}`,
      },
    })

    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    console.error('POST /api/videos/activity error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
