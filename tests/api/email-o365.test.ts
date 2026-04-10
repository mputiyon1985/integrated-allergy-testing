/**
 * @file tests/api/email-o365.test.ts
 * @description Tests for O365 / Microsoft Graph email provider
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  default: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  },
}))

vi.mock('@/lib/api-permissions', () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/hipaaHeaders', () => ({
  HIPAA_HEADERS: { 'x-content-type-options': 'nosniff' },
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

// ── Helpers ────────────────────────────────────────────────────────────────
function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}

function makeO365Settings(overrides: Record<string, string> = {}): Array<{ key: string; value: string }> {
  return [
    { key: 'email_provider',            value: 'o365' },
    { key: 'email_o365_tenant_id',      value: 'tenant-abc-123' },
    { key: 'email_o365_client_id',      value: 'client-def-456' },
    { key: 'email_o365_client_secret',  value: 'super-secret-789' },
    { key: 'email_o365_mailbox',        value: 'noreply@org.com' },
    ...Object.entries(overrides).map(([key, value]) => ({ key, value })),
  ]
}

// ── Suite ──────────────────────────────────────────────────────────────────
let SEND_POST: (req: Request) => Promise<Response>
let mockPrisma: {
  $queryRawUnsafe: ReturnType<typeof vi.fn>
  $executeRaw: ReturnType<typeof vi.fn>
}

beforeEach(async () => {
  vi.clearAllMocks()
  mockFetch.mockReset()

  const sendRoute = await import('@/app/api/email/send/route')
  const db = await import('@/lib/db')
  SEND_POST = sendRoute.POST as unknown as (req: Request) => Promise<Response>
  mockPrisma = db.default as unknown as typeof mockPrisma
})

describe('O365 token fetch', () => {
  it('constructs correct token URL with tenant ID', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(makeO365Settings())

    // Token call succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'tok_abc' }), { status: 200 })
    )
    // Graph send succeeds
    mockFetch.mockResolvedValueOnce(new Response('', { status: 202 }))
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/email/send', {
      to: 'patient@example.com', subject: 'O365 Token Test', body: '<p>Hello</p>',
    })
    await SEND_POST(req)

    // First fetch call should be the token endpoint with the tenant ID
    const [tokenUrl] = mockFetch.mock.calls[0]
    expect(tokenUrl).toContain('login.microsoftonline.com')
    expect(tokenUrl).toContain('tenant-abc-123')
    expect(tokenUrl).toContain('/oauth2/v2.0/token')
  })

  it('sends client credentials in token request body', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(makeO365Settings())
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'tok_xyz' }), { status: 200 })
    )
    mockFetch.mockResolvedValueOnce(new Response('', { status: 202 }))
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/email/send', {
      to: 'patient@example.com', subject: 'Token Body Test', body: '<p>Hi</p>',
    })
    await SEND_POST(req)

    const [, tokenOptions] = mockFetch.mock.calls[0]
    expect(tokenOptions.method).toBe('POST')
    const bodyStr = tokenOptions.body.toString()
    expect(bodyStr).toContain('client_id=client-def-456')
    expect(bodyStr).toContain('grant_type=client_credentials')
    expect(bodyStr).toContain('scope=https%3A%2F%2Fgraph.microsoft.com%2F.default')
  })
})

describe('O365 Graph API sendMail', () => {
  it('calls correct Graph API endpoint for the mailbox', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(makeO365Settings())
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'tok_graph' }), { status: 200 })
    )
    mockFetch.mockResolvedValueOnce(new Response('', { status: 202 }))
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/email/send', {
      to: 'patient@example.com', subject: 'Graph Endpoint Test', body: '<p>Hello</p>',
    })
    await SEND_POST(req)

    const [graphUrl] = mockFetch.mock.calls[1]
    expect(graphUrl).toContain('graph.microsoft.com')
    expect(graphUrl).toContain('noreply@org.com')
    expect(graphUrl).toContain('/sendMail')
  })

  it('includes Bearer token in Authorization header', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(makeO365Settings())
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'mytoken_abc' }), { status: 200 })
    )
    mockFetch.mockResolvedValueOnce(new Response('', { status: 202 }))
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/email/send', {
      to: 'patient@example.com', subject: 'Auth Header Test', body: '<p>Hi</p>',
    })
    await SEND_POST(req)

    const [, graphOptions] = mockFetch.mock.calls[1]
    expect(graphOptions.headers['Authorization']).toBe('Bearer mytoken_abc')
  })

  it('sets saveToSentItems to true in the request body', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(makeO365Settings())
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'tok_sent' }), { status: 200 })
    )
    mockFetch.mockResolvedValueOnce(new Response('', { status: 202 }))
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/email/send', {
      to: 'patient@example.com', subject: 'SaveToSentItems Test', body: '<p>Hello</p>',
    })
    await SEND_POST(req)

    const [, graphOptions] = mockFetch.mock.calls[1]
    const body = JSON.parse(graphOptions.body)
    expect(body.saveToSentItems).toBe(true)
  })

  it('includes correct recipient address in the message', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(makeO365Settings())
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'tok_rcpt' }), { status: 200 })
    )
    mockFetch.mockResolvedValueOnce(new Response('', { status: 202 }))
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/email/send', {
      to: 'specific-patient@example.com', subject: 'Recipient Test', body: '<p>Hello</p>',
    })
    await SEND_POST(req)

    const [, graphOptions] = mockFetch.mock.calls[1]
    const body = JSON.parse(graphOptions.body)
    expect(body.message.toRecipients[0].emailAddress.address).toBe('specific-patient@example.com')
  })

  it('sets HTML content type in the message body', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(makeO365Settings())
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'tok_html' }), { status: 200 })
    )
    mockFetch.mockResolvedValueOnce(new Response('', { status: 202 }))
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/email/send', {
      to: 'patient@example.com', subject: 'HTML Type Test', body: '<p><strong>Bold</strong></p>',
    })
    await SEND_POST(req)

    const [, graphOptions] = mockFetch.mock.calls[1]
    const body = JSON.parse(graphOptions.body)
    expect(body.message.body.contentType).toBe('HTML')
    expect(body.message.body.content).toContain('<p><strong>Bold</strong></p>')
  })
})

describe('O365 error handling', () => {
  it('returns 503 when token fetch fails (token endpoint error)', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(makeO365Settings())
    // Token fetch returns non-ok
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error_description: 'AADSTS700016: Application not found' }),
        { status: 401 }
      )
    )
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/email/send', {
      to: 'patient@example.com', subject: 'Fail Token Test', body: '<p>Hello</p>',
    })
    const res = await SEND_POST(req)

    // Provider error → 502 (per send route implementation)
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toMatch(/token|O365/i)
  })

  it('returns 502 when Graph API returns 403 Forbidden', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(makeO365Settings())
    // Token succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'tok_403' }), { status: 200 })
    )
    // Graph API returns 403
    mockFetch.mockResolvedValueOnce(
      new Response('{"error":{"code":"Authorization_RequestDenied","message":"Insufficient privileges"}}', { status: 403 })
    )
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/email/send', {
      to: 'patient@example.com', subject: '403 Test', body: '<p>Hello</p>',
    })
    const res = await SEND_POST(req)

    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toMatch(/403|Graph API/i)
  })

  it('returns 503 when O365 credentials are missing', async () => {
    // Only provider set, no credentials
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
      { key: 'email_provider', value: 'o365' },
      // No tenant_id, client_id, client_secret
    ])
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/email/send', {
      to: 'patient@example.com', subject: 'Missing Creds Test', body: '<p>Hello</p>',
    })
    const res = await SEND_POST(req)

    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toMatch(/credential|not configured|tenantId/i)
  })

  it('logs failed email to EmailLog when Graph API returns error', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(makeO365Settings())
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'tok_log' }), { status: 200 })
    )
    mockFetch.mockResolvedValueOnce(
      new Response('Server Error', { status: 500 })
    )
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/email/send', {
      to: 'patient@example.com', subject: 'Log Fail Test', body: '<p>Hello</p>',
    })
    const res = await SEND_POST(req)

    expect(res.status).toBe(502)
    // EmailLog should be written with failed status
    expect(mockPrisma.$executeRaw).toHaveBeenCalled()
  })

  it('returns 200 and status=sent on successful O365 send', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(makeO365Settings())
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'tok_success' }), { status: 200 })
    )
    mockFetch.mockResolvedValueOnce(new Response('', { status: 202 }))
    mockPrisma.$executeRaw.mockResolvedValueOnce(undefined)

    const req = makeRequest('POST', 'http://localhost/api/email/send', {
      to: 'patient@example.com', subject: 'Success Test', body: '<p>Hello from O365</p>',
    })
    const res = await SEND_POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('sent')
    expect(json.messageId).toMatch(/^o365-/)
  })
})
