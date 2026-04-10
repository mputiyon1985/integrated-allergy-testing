/**
 * GET /api/email/settings — returns settings (API key masked)
 * PUT /api/email/settings — saves settings
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const SETTING_KEYS = ['resend_api_key', 'from_email', 'from_name']

export async function GET(request: NextRequest) {
  const denied = await requirePermission(request, 'patients_view')
  if (denied) return denied

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ key: string; value: string }>>(
      `SELECT key, value FROM SystemSetting WHERE key IN ('resend_api_key','from_email','from_name')`
    )
    const map: Record<string, string> = {}
    rows.forEach(r => { map[r.key] = r.value ?? '' })

    // Mask API key
    const rawKey = map['resend_api_key'] ?? ''
    const maskedKey = rawKey.length > 8
      ? `${rawKey.slice(0, 3)}${'*'.repeat(rawKey.length - 6)}${rawKey.slice(-3)}`
      : rawKey ? '***' : ''

    return NextResponse.json({
      apiKey: maskedKey,
      apiKeyConfigured: rawKey.length > 0,
      fromEmail: map['from_email'] ?? '',
      fromName: map['from_name'] ?? '',
    })
  } catch (error) {
    console.error('GET /api/email/settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requirePermission(request, 'patients_view')
  if (denied) return denied

  try {
    const body = await request.json() as { apiKey?: string; fromEmail?: string; fromName?: string }
    const now = new Date().toISOString()

    const upserts: Array<[string, string]> = []
    if (body.apiKey && !body.apiKey.includes('*')) {
      upserts.push(['resend_api_key', body.apiKey])
    }
    if (body.fromEmail !== undefined) upserts.push(['from_email', body.fromEmail])
    if (body.fromName !== undefined) upserts.push(['from_name', body.fromName])

    for (const [key, value] of upserts) {
      await prisma.$executeRaw`INSERT INTO SystemSetting (key, value, updatedAt) VALUES (${key}, ${value}, ${now})
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PUT /api/email/settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export { SETTING_KEYS }
