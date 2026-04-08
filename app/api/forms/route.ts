/**
 * @file /api/forms — Form template management
 * @description Manages form templates used for patient consent and intake.
 *   GET  — Return all active form templates.
 *   POST — Create a new form template (name, type, and template required).
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const forms = await prisma.form.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(forms)
  } catch (error) {
    console.error('GET /api/forms error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name?: string
      type?: string
      template?: string
    }

    const { name, type, template } = body

    if (!name || !type || !template) {
      return NextResponse.json(
        { error: 'name, type, and template are required' },
        { status: 400 }
      )
    }

    // Sanitize template: strip <script>, <iframe>, on* attributes, and javascript: hrefs
    // to reduce XSS risk when rendered via dangerouslySetInnerHTML in consent pages.
    const sanitizedTemplate = template
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')
      .replace(/\bon\w+\s*=/gi, 'data-blocked=')
      .replace(/javascript\s*:/gi, 'blocked:')
      .replace(/vbscript\s*:/gi, 'blocked:')
      .replace(/data\s*:\s*text\s*\/\s*html/gi, 'blocked:')

    const form = await prisma.form.create({
      data: { name, type, template: sanitizedTemplate },
    })

    return NextResponse.json(form, { status: 201 })
  } catch (error) {
    console.error('POST /api/forms error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
