import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const count = await prisma.staffUser.count()
    return NextResponse.json({ ok: true, staffUsers: count, dbUrl: process.env.DATABASE_URL?.substring(0,30) })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ ok: false, error: err.message, stack: err.stack?.substring(0,300) }, { status: 500 })
  }
}
