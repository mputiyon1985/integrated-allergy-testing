/**
 * @file /api/videos — Patient education video library
 * @description Manages the video library used in the patient kiosk education workflow.
 *   GET  — Return all active videos ordered by display order.
 *   POST — Create a new video entry (title and url required).
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const videos = await prisma.video.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(videos)
  } catch (error) {
    console.error('GET /api/videos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await requirePermission(request, 'videos_manage')
  if (denied) return denied
  try {
    const body = await request.json() as {
      title?: string
      description?: string
      url?: string
      duration?: number
      category?: string
      order?: number
    }

    const { title, url } = body

    if (!title || !url) {
      return NextResponse.json(
        { error: 'title and url are required' },
        { status: 400 }
      )
    }

    const video = await prisma.video.create({
      data: {
        title,
        description: body.description,
        url,
        duration: body.duration,
        category: body.category,
        order: body.order ?? 0,
      },
    })

    prisma.auditLog.create({
      data: {
        action: 'VIDEO_CREATED',
        entity: 'Video',
        entityId: video.id,
        patientId: null,
        details: `Video created: ${video.title}`,
      },
    }).catch(() => {})

    return NextResponse.json(video, { status: 201 })
  } catch (error) {
    console.error('POST /api/videos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
