/**
 * @file /api/waiting-room/stream — SSE stream for waiting room updates
 * @description
 *   GET — Returns a Server-Sent Events stream that pushes waiting room updates every 8 seconds.
 *   Replaces the 10-second polling interval in the dashboard.
 */
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { verifySession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

async function fetchWaitingRoom(locationId: string, practiceId: string) {
  try {
    if (locationId) {
      return await prisma.$queryRaw`
        SELECT * FROM WaitingRoom
        WHERE status IN ('waiting','in-service') AND locationId = ${locationId}
        ORDER BY checkedInAt ASC
      `
    } else if (practiceId) {
      return await prisma.$queryRaw`
        SELECT * FROM WaitingRoom
        WHERE status IN ('waiting','in-service')
          AND locationId IN (SELECT id FROM Location WHERE practiceId = ${practiceId} AND deletedAt IS NULL)
        ORDER BY checkedInAt ASC
      `
    } else {
      return await prisma.$queryRaw`
        SELECT * FROM WaitingRoom
        WHERE status IN ('waiting','in-service')
        ORDER BY checkedInAt ASC
      `
    }
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req)
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(req.url)
  const locationId = url.searchParams.get('locationId') ?? ''
  const practiceId = url.searchParams.get('practiceId') ?? ''

  const encoder = new TextEncoder()
  let closed = false

  // Handle client disconnect via AbortSignal
  req.signal.addEventListener('abort', () => { closed = true })

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data immediately
      try {
        const entries = await fetchWaitingRoom(locationId, practiceId)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(entries)}\n\n`))
      } catch {
        controller.enqueue(encoder.encode(`data: []\n\n`))
      }

      // Poll every 8 seconds
      let lastHash = ''
      const poll = async () => {
        if (closed) return
        try {
          const entries = await fetchWaitingRoom(locationId, practiceId)
          const hash = JSON.stringify(entries)
          if (hash !== lastHash) {
            lastHash = hash
            controller.enqueue(encoder.encode(`data: ${hash}\n\n`))
          }
        } catch {
          // Ignore DB errors during poll
        }
        if (!closed) {
          await new Promise(resolve => setTimeout(resolve, 8000))
          poll()
        }
      }

      // Start polling after first send
      await new Promise(resolve => setTimeout(resolve, 8000))
      poll()
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
