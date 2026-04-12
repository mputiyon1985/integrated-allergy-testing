/**
 * @file /api/ping — Keep-warm endpoint
 * @description Hit by Vercel cron every 5 minutes to prevent cold starts.
 * @security Public (no auth needed — returns minimal data)
 */
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const t = Date.now()
  try {
    await prisma.$queryRawUnsafe('SELECT 1 as ok')
    return NextResponse.json({ ok: true, db: 'warm', ms: Date.now() - t, ts: new Date().toISOString() })
  } catch {
    return NextResponse.json({ ok: true, db: 'error', ms: Date.now() - t })
  }
}
