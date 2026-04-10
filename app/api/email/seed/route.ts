/**
 * POST /api/email/seed — seed default email templates if none exist
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const DEFAULT_TEMPLATES = [
  {
    name: 'Appointment Reminder',
    category: 'appointment_reminder',
    subject: 'Reminder: Your Appointment on {{date}}',
    body: `<p>Hi {{patientName}},</p>
<p>This is a friendly reminder that your appointment is scheduled for <strong>{{date}}</strong> at <strong>{{time}}</strong> at <strong>{{location}}</strong>.</p>
<p>If you need to reschedule or have questions, please call our office.</p>
<p>Thank you,<br/>{{practiceName}}</p>`,
  },
  {
    name: 'Test Results Ready',
    category: 'test_results',
    subject: 'Your Allergy Test Results Are Ready',
    body: `<p>Hi {{patientName}},</p>
<p>Your allergy test results are ready. Please contact our office to discuss your results with your provider.</p>
<p>Thank you,<br/>{{practiceName}}</p>`,
  },
  {
    name: 'Welcome New Patient',
    category: 'general',
    subject: 'Welcome to {{practiceName}}!',
    body: `<p>Welcome to <strong>{{practiceName}}</strong>!</p>
<p>We're glad to have you as a patient. Our team is dedicated to providing you with the highest quality allergy care.</p>
<p>If you have any questions before your first appointment, please don't hesitate to contact us.</p>
<p>Thank you,<br/>{{practiceName}}</p>`,
  },
  {
    name: 'Billing Statement',
    category: 'billing',
    subject: 'Billing Statement from {{practiceName}}',
    body: `<p>Hi {{patientName}},</p>
<p>You have a balance due on your account. Please contact our billing department at your earliest convenience to discuss payment options.</p>
<p>Thank you,<br/>{{practiceName}}</p>`,
  },
]

export async function POST(request: NextRequest) {
  const denied = await requirePermission(request, 'patients_view')
  if (denied) return denied

  try {
    const existing = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*) as count FROM EmailTemplate`
    )
    if (existing[0]?.count > 0) {
      return NextResponse.json({ message: 'Templates already exist', count: existing[0].count })
    }

    const now = new Date().toISOString()
    for (const tpl of DEFAULT_TEMPLATES) {
      const id = `etpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      await prisma.$executeRaw`INSERT INTO EmailTemplate (id, name, subject, body, category, active, createdAt, updatedAt)
        VALUES (${id}, ${tpl.name}, ${tpl.subject}, ${tpl.body}, ${tpl.category}, 1, ${now}, ${now})`
    }

    return NextResponse.json({ message: 'Seeded 4 default templates', count: DEFAULT_TEMPLATES.length }, { status: 201 })
  } catch (error) {
    console.error('POST /api/email/seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
