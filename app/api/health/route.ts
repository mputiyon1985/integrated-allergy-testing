import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const count = await prisma.staffUser.count()
    return NextResponse.json({ ok: true, staffUsers: count, dbUrl: process.env.DATABASE_URL, hasToken: !!process.env.DATABASE_AUTH_TOKEN })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ ok: false, error: err.message, dbUrl: process.env.DATABASE_URL, hasToken: !!process.env.DATABASE_AUTH_TOKEN }, { status: 500 })
  }
}
