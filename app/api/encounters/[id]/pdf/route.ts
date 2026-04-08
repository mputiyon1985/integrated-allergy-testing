/**
 * @file /api/encounters/[id]/pdf — Clinical encounter summary PDF
 * @description
 *   GET — Generates and returns a clinical encounter summary PDF using jsPDF.
 *   Includes patient info, encounter details, SOAP notes, and HIPAA footer.
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { jsPDF } from 'jspdf'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const encounter = await prisma.encounter.findUnique({
      where: { id: params.id },
    })

    if (!encounter || encounter.deletedAt) {
      return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
    }

    const patient = await prisma.patient.findUnique({
      where: { id: encounter.patientId },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()

    // ── Header ────────────────────────────────────────────────────────────────
    doc.setFontSize(20)
    doc.setTextColor('#0055A5')
    doc.text('Integrated Allergy Testing', pageW / 2, 20, { align: 'center' })

    doc.setFontSize(14)
    doc.setTextColor('#1a2233')
    doc.text('Encounter Summary', pageW / 2, 30, { align: 'center' })

    doc.setDrawColor('#e2e8f0')
    doc.setLineWidth(0.5)
    doc.line(20, 36, 190, 36)

    // ── Patient Info ──────────────────────────────────────────────────────────
    doc.setFontSize(11)
    doc.setTextColor('#374151')

    const dob = patient.dob
      ? new Date(patient.dob).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : '—'
    const patientDisplayId = patient.patientId ?? patient.id.slice(0, 8).toUpperCase()

    doc.text('PATIENT INFORMATION', 20, 46)
    doc.setFontSize(10)
    doc.setTextColor('#6b7280')
    doc.text(`Name:`, 20, 54)
    doc.text(`DOB:`, 20, 62)
    doc.text(`Patient ID:`, 20, 70)

    doc.setTextColor('#111827')
    doc.text(patient.name, 60, 54)
    doc.text(dob, 60, 62)
    doc.text(patientDisplayId, 60, 70)

    // ── Encounter Details ─────────────────────────────────────────────────────
    const encDate = new Date(encounter.encounterDate).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })

    doc.setFontSize(11)
    doc.setTextColor('#374151')
    doc.text('ENCOUNTER DETAILS', 110, 46)
    doc.setFontSize(10)
    doc.setTextColor('#6b7280')
    doc.text(`Date:`, 110, 54)
    doc.text(`Physician:`, 110, 62)
    doc.text(`Nurse:`, 110, 70)

    doc.setTextColor('#111827')
    doc.text(encDate, 140, 54)
    doc.text(encounter.doctorName ?? '—', 140, 62)
    doc.text(encounter.nurseName ?? '—', 140, 70)

    doc.setDrawColor('#e2e8f0')
    doc.line(20, 76, 190, 76)

    // ── SOAP Sections ─────────────────────────────────────────────────────────
    let y = 86

    const addSection = (title: string, content: string | null) => {
      if (!content) return

      // Section heading
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor('#0055A5')
      doc.text(title, 20, y)
      y += 6

      // Content
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor('#1a2233')
      const lines = doc.splitTextToSize(content, 170)
      for (const line of lines) {
        if (y > 265) {
          doc.addPage()
          y = 20
        }
        doc.text(line, 20, y)
        y += 5
      }
      y += 4
    }

    addSection('Chief Complaint', encounter.chiefComplaint)
    addSection('Subjective', encounter.subjectiveNotes)
    addSection('Objective', encounter.objectiveNotes)
    addSection('Assessment', encounter.assessment)
    addSection('Plan', encounter.plan)

    if (encounter.followUpDays != null) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor('#0055A5')
      if (y > 265) { doc.addPage(); y = 20 }
      doc.text('Follow-Up', 20, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor('#1a2233')
      doc.text(`Return in ${encounter.followUpDays} day(s)`, 20, y)
      y += 9
    }

    // Status badge
    if (y > 260) { doc.addPage(); y = 20 }
    doc.setDrawColor('#e2e8f0')
    doc.line(20, y, 190, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#374151')
    const statusLabel = `Status: ${encounter.status.toUpperCase()}`
    doc.text(statusLabel, 20, y)

    // ── Footer ────────────────────────────────────────────────────────────────
    const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
    const datePrinted = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor('#94a3b8')
      doc.text(
        `HIPAA Compliant — Confidential Patient Record — Integrated Allergy Testing`,
        pageW / 2, 285, { align: 'center' }
      )
      doc.text(
        `Date Printed: ${datePrinted}   |   Page ${i} of ${totalPages}`,
        pageW / 2, 290, { align: 'center' }
      )
    }

    const pdfBytes = doc.output('arraybuffer')
    const safeId = patientDisplayId.replace(/[^a-zA-Z0-9]/g, '')
    const encDateStr = new Date(encounter.encounterDate).toISOString().slice(0, 10)

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="encounter-${safeId}-${encDateStr}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Encounter PDF error:', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
