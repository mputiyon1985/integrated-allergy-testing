import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('iat_session', '', { maxAge: 0, path: '/' })
  return response
}
