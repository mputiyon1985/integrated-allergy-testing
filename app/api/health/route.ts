import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const result = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>('SELECT COUNT(*) as count FROM StaffUser')
    const _count = result[0]?.count
    return NextResponse.json({ ok: true })
  } catch (e) {
    const err = e as Error
    // Never expose DB URLs or credentials in health check responses
    console.error('Health check failed:', err.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
