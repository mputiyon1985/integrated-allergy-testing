import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { jsPDF } from 'jspdf'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get('patientId')
    const formId = searchParams.get('formId')
    if (!patientId || !formId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const [patient, form, record] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId } }),
      prisma.form.findUnique({ where: { id: formId } }),
      prisma.consentRecord.findFirst({
        where: { patientId, formId },
        orderBy: { signedAt: 'desc' },
      }),
    ])

    if (!patient || !form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const doc = new jsPDF()

    // Header
    doc.setFontSize(18)
    doc.setTextColor('#0055A5')
    doc.text('Integrated Allergy Testing', 105, 20, { align: 'center' })
    doc.setFontSize(14)
    doc.setTextColor('#000000')
    doc.text(form.name, 105, 30, { align: 'center' })

    // Divider
    doc.setDrawColor('#e2e8f0')
    doc.line(20, 36, 190, 36)

    // Patient info
    doc.setFontSize(11)
    doc.setTextColor('#374151')
    doc.text(`Patient: ${patient.name}`, 20, 48)
    doc.text(`Patient ID: ${patient.patientId ?? patient.id.slice(0, 8).toUpperCase()}`, 20, 56)
    doc.text(`DOB: ${patient.dob ? new Date(patient.dob).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}`, 20, 64)
    doc.text(
      `Date Signed: ${record ? new Date(record.signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not signed'}`,
      20, 72
    )

    // Divider
    doc.line(20, 78, 190, 78)

    // Consent text (strip HTML)
    const plainText = (form.template || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()

    const lines = doc.splitTextToSize(plainText, 170)
    let y = 88
    doc.setFontSize(10)
    doc.setTextColor('#1a2233')

    for (const line of lines) {
      if (y > 250) {
        doc.addPage()
        y = 20
      }
      doc.text(line, 20, y)
      y += 5
    }

    // Signature section
    y += 10
    if (y > 240) {
      doc.addPage()
      y = 20
    }

    doc.setDrawColor('#e2e8f0')
    doc.line(20, y - 4, 190, y - 4)

    doc.setFontSize(11)
    doc.setTextColor('#374151')
    doc.text('Patient Signature:', 20, y + 6)

    if (record?.signature) {
      try {
        doc.addImage(record.signature, 'PNG', 20, y + 10, 80, 30)
        y += 45
      } catch {
        // fallback to blank line if image fails
        doc.line(20, y + 20, 120, y + 20)
        y += 28
      }
    } else {
      doc.line(20, y + 20, 120, y + 20)
      y += 28
    }

    // Footer
    doc.setFontSize(9)
    doc.setTextColor('#94a3b8')
    doc.text(
      'This document is a legally binding consent. HIPAA Compliant. Integrated Allergy Testing.',
      105,
      285,
      { align: 'center' }
    )

    const pdfBytes = doc.output('arraybuffer')

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="consent-${patient.patientId ?? patient.id.slice(0, 8)}-${formId}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Consent PDF error:', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
