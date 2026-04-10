/**
 * POST /api/email/send
 * Sends an email via configured provider (Resend or Microsoft 365/Exchange via Graph API)
 * and logs it to EmailLog
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export const dynamic = 'force-dynamic'

// ── Resend sender ──────────────────────────────────────────────────────────────
async function sendViaResend(
  to: string,
  subject: string,
  htmlBody: string,
  settings: Record<string, string>
): Promise<{ messageId: string; status: string }> {
  const apiKey = settings['resend_api_key']
  if (!apiKey) throw new Error('Resend API key not configured')

  const fromEmail = settings['from_email'] || 'noreply@integratedallergytest.com'
  const fromName = settings['from_name'] || 'Integrated Allergy Testing'

  const res = await fetch('https://api.resend.com/emails', {
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

  const data = await res.json() as { id?: string; message?: string }
  if (!res.ok) throw new Error(data.message ?? 'Resend API error')
  return { messageId: data.id ?? `resend-${Date.now()}`, status: 'sent' }
}

// ── O365 / Microsoft Graph sender ─────────────────────────────────────────────
async function sendViaO365(
  to: string,
  subject: string,
  htmlBody: string,
  settings: Record<string, string>
): Promise<{ messageId: string; status: string }> {
  const tenantId = settings['email_o365_tenant_id']
  const clientId = settings['email_o365_client_id']

  // Resolve client secret: DB first, Key Vault fallback
  let clientSecret = settings['email_o365_client_secret'] || ''
  if (!clientSecret) {
    try {
      const { DefaultAzureCredential } = await import('@azure/identity')
      const { SecretClient } = await import('@azure/keyvault-secrets')
      const vaultUrl = 'https://hivevault-swarm.vault.azure.net'
      const kvClient = new SecretClient(vaultUrl, new DefaultAzureCredential())
      const secret = await kvClient.getSecret('mark-azure-ad-client-secret')
      clientSecret = secret.value ?? ''
    } catch (kvErr) {
      console.error('Key Vault fallback failed:', kvErr)
    }
  }

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('O365 credentials not configured (tenantId, clientId, clientSecret required)')
  }

  // 1. Get access token
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  )
  const tokenData = await tokenRes.json() as { access_token?: string; error_description?: string }
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`O365 token error: ${tokenData.error_description ?? 'Unknown'}`)
  }

  // 2. Send via Graph API
  const mailbox = settings['email_o365_mailbox'] || settings['email_from_address'] || settings['from_email']
  if (!mailbox) throw new Error('O365 send-from mailbox not configured')

  const graphRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${mailbox}/sendMail`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: htmlBody },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
    }
  )

  if (!graphRes.ok && graphRes.status !== 202) {
    const err = await graphRes.text()
    throw new Error(`Graph API error ${graphRes.status}: ${err}`)
  }

  return { messageId: `o365-${Date.now()}`, status: 'sent' }
}

// ── Route handler ──────────────────────────────────────────────────────────────
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

    // Fetch all relevant settings
    const settingsRows = await prisma.$queryRawUnsafe<Array<{ key: string; value: string }>>(
      `SELECT key, value FROM SystemSetting WHERE key IN (
        'resend_api_key','from_email','from_name',
        'email_provider',
        'email_o365_client_id','email_o365_client_secret','email_o365_tenant_id','email_o365_mailbox',
        'email_from_address'
      )`
    )
    const settings: Record<string, string> = {}
    settingsRows.forEach(s => { settings[s.key] = s.value ?? '' })

    const provider = settings['email_provider'] ?? 'resend'
    const logId = `elog-${Date.now().toString(36)}`
    const now = new Date().toISOString()

    let result: { messageId: string; status: string }

    try {
      if (provider === 'o365') {
        result = await sendViaO365(to, subject, htmlBody, settings)
      } else {
        const apiKey = settings['resend_api_key']
        if (!apiKey) {
          return NextResponse.json(
            { error: 'Email provider not configured. Please add your Resend API key in Settings → Email.' },
            { status: 503 }
          )
        }
        result = await sendViaResend(to, subject, htmlBody, settings)
      }
    } catch (sendErr) {
      const errMsg = sendErr instanceof Error ? sendErr.message : 'Unknown error'
      await prisma.$executeRaw`INSERT INTO EmailLog (id, patientId, patientEmail, subject, templateId, status, errorMessage, createdAt)
        VALUES (${logId}, ${patientId ?? null}, ${to}, ${subject}, ${templateId ?? null}, 'failed', ${errMsg}, ${now})`
      return NextResponse.json({ error: errMsg }, { status: 502 })
    }

    // Log success
    await prisma.$executeRaw`INSERT INTO EmailLog (id, patientId, patientEmail, subject, templateId, status, sentAt, createdAt)
      VALUES (${logId}, ${patientId ?? null}, ${to}, ${subject}, ${templateId ?? null}, 'sent', ${now}, ${now})`

    return NextResponse.json({ messageId: result.messageId, status: 'sent' }, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('POST /api/email/send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
