import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json() as { title?: string; url?: string | null; description?: string | null; category?: string | null; duration?: string | null }
    const video = await prisma.video.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.url !== undefined && { url: body.url ?? '' }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.category !== undefined && { category: body.category }),
      },
    })

    prisma.auditLog.create({
      data: {
        action: 'VIDEO_UPDATED',
        entity: 'Video',
        entityId: video.id,
        patientId: null,
        details: `Video updated: ${video.title}`,
      },
    }).catch(() => {})

    return NextResponse.json({ video })
  } catch (error) {
    console.error('PUT /api/videos/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update video' }, { status: 500 })
  }
}
