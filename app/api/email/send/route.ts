/**
 * POST /api/email/send
 * Sends an email via Resend API and logs it to EmailLog
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const denied = await requirePermission(request, 'patients_view')
  if (denied) return denied

  try {
    const body = await request.json()
    const { patientId, to, subject, body: htmlBody, templateId } = body as {
      patientId?: string
      to: string
      subject: string
      body: string
      templateId?: string
    }

    if (!to || !subject || !htmlBody) {
      return NextResponse.json({ error: 'to, subject, and body are required' }, { status: 400 })
    }

    // Fetch settings
    const settings = await prisma.$queryRawUnsafe<Array<{ key: string; value: string }>>(
      `SELECT key, value FROM SystemSetting WHERE key IN ('resend_api_key','from_email','from_name')`
    )
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => { settingsMap[s.key] = s.value ?? '' })

    const apiKey = settingsMap['resend_api_key']
    if (!apiKey) {
      return NextResponse.json({ error: 'Email provider not configured. Please add your Resend API key in Settings → Email.' }, { status: 503 })
    }

    const fromEmail = settingsMap['from_email'] || 'noreply@integratedallergytest.com'
    const fromName = settingsMap['from_name'] || 'Integrated Allergy Testing'

    // Call Resend API
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html: htmlBody,
      }),
    })

    const resendData = await resendRes.json() as { id?: string; message?: string; name?: string }
    const logId = `elog-${Date.now().toString(36)}`
    const now = new Date().toISOString()

    if (!resendRes.ok) {
      // Log failure
      await prisma.$executeRaw`INSERT INTO EmailLog (id, patientId, patientEmail, subject, templateId, status, errorMessage, createdAt)
        VALUES (${logId}, ${patientId ?? null}, ${to}, ${subject}, ${templateId ?? null}, 'failed', ${resendData.message ?? 'Unknown error'}, ${now})`
      return NextResponse.json({ error: resendData.message ?? 'Failed to send email' }, { status: 502 })
    }

    // Log success
    await prisma.$executeRaw`INSERT INTO EmailLog (id, patientId, patientEmail, subject, templateId, status, sentAt, createdAt)
      VALUES (${logId}, ${patientId ?? null}, ${to}, ${subject}, ${templateId ?? null}, 'sent', ${now}, ${now})`

    return NextResponse.json({ messageId: resendData.id, status: 'sent' }, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('POST /api/email/send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
