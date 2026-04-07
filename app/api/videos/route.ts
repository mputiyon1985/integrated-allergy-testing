import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

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

    return NextResponse.json(video, { status: 201 })
  } catch (error) {
    console.error('POST /api/videos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
