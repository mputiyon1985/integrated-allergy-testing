/**
 * @file /api/encounters/[id]/pdf — Superbill PDF generation
 * @description
 *   GET — Generates a clinical superbill PDF with CPT codes, ICD-10, MD signature.
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { jsPDF } from 'jspdf'

export const dynamic = 'force-dynamic'

interface CPTEntry {
  code: string
  description: string
  units: number
  fee: number
  total: number
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = (await params)

    const encounterRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "Encounter" WHERE id=? AND deletedAt IS NULL`, id
    )
    if (!encounterRows.length) {
      return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
    }
    const encounter = encounterRows[0]

    const patient = await prisma.patient.findUnique({
      where: { id: encounter.patientId as string },
    })
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Parse CPT summary if exists
    let cptCodes: CPTEntry[] = []
    if (encounter.cptSummary) {
      try { cptCodes = JSON.parse(encounter.cptSummary as string) } catch { /* ignore */ }
    }

    // Fetch ICD-10 description if diagnosisCode set
    let icd10Description = ''
    if (encounter.diagnosisCode) {
      const icdRows = await prisma.$queryRawUnsafe<{ description: string }[]>(
        `SELECT description FROM "ICD10Code" WHERE code=? LIMIT 1`,
        encounter.diagnosisCode
      )
      icd10Description = icdRows[0]?.description ?? ''
    }

    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 20

    // ── SUPERBILL Header ──────────────────────────────────────────────────────
    doc.setFontSize(22)
    doc.setTextColor('#0d9488')
    doc.setFont('helvetica', 'bold')
    doc.text('SUPERBILL', pageW / 2, 20, { align: 'center' })

    doc.setFontSize(14)
    doc.setTextColor('#1a2233')
    doc.text('Integrated Allergy Testing', pageW / 2, 30, { align: 'center' })

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#64748b')
    doc.text('14005 St. Germain Dr, Suite 100  ·  Centreville, VA 20121', pageW / 2, 37, { align: 'center' })
    doc.text('NPI: 1234567890  ·  Tax ID: 12-3456789  ·  Phone: (703) 555-0100', pageW / 2, 43, { align: 'center' })

    doc.setDrawColor('#0d9488')
    doc.setLineWidth(1.5)
    doc.line(margin, 48, 190, 48)

    // ── Two-column info block ─────────────────────────────────────────────────
    let y = 56
    const col2 = 110

    // Left: Patient
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#374151')
    doc.text('PATIENT', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#111827')
    y += 5

    const dob = patient.dob
      ? new Date(patient.dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—'
    const patientDisplayId = (patient as Record<string, unknown>).patientId
      ? String((patient as Record<string, unknown>).patientId)
      : patient.id.slice(0, 8).toUpperCase()

    doc.setFontSize(9)
    doc.setTextColor('#6b7280')
    doc.text('Name:', margin, y); doc.setTextColor('#111827'); doc.text(patient.name, margin + 22, y); y += 5
    doc.setTextColor('#6b7280')
    doc.text('DOB:', margin, y); doc.setTextColor('#111827'); doc.text(dob, margin + 22, y); y += 5
    doc.setTextColor('#6b7280')
    doc.text('MRN:', margin, y); doc.setTextColor('#111827'); doc.text(patientDisplayId, margin + 22, y); y += 5
    doc.setTextColor('#6b7280')
    doc.text('Insurance:', margin, y)
    doc.setTextColor('#111827')
    const insurance = (patient as Record<string, unknown>).insuranceId
      ? String((patient as Record<string, unknown>).insuranceId)
      : '—'
    doc.text(insurance, margin + 22, y)

    // Right: Provider + Service
    const encDate = new Date(encounter.encounterDate as string | number)
    const encDateStr = encDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })

    let y2 = 56
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#374151')
    doc.setFontSize(9)
    doc.text('SERVICE & PROVIDER', col2, y2)
    doc.setFont('helvetica', 'normal')
    y2 += 5

    doc.setTextColor('#6b7280')
    doc.text('Date of Service:', col2, y2); doc.setTextColor('#111827'); doc.text(encDateStr, col2 + 30, y2); y2 += 5
    doc.setTextColor('#6b7280')
    doc.text('Provider:', col2, y2); doc.setTextColor('#111827'); doc.text(String(encounter.doctorName ?? '—'), col2 + 30, y2); y2 += 5
    doc.setTextColor('#6b7280')
    doc.text('NPI:', col2, y2); doc.setTextColor('#111827'); doc.text('1234567890', col2 + 30, y2); y2 += 5
    doc.setTextColor('#6b7280')
    doc.text('RN:', col2, y2); doc.setTextColor('#111827'); doc.text(String(encounter.nurseName ?? '—'), col2 + 30, y2)

    y = Math.max(y, y2) + 10

    doc.setDrawColor('#e2e8f0')
    doc.setLineWidth(0.5)
    doc.line(margin, y, 190, y)
    y += 6

    // ── Diagnosis ─────────────────────────────────────────────────────────────
    if (encounter.diagnosisCode) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor('#374151')
      doc.text('DIAGNOSIS (ICD-10)', margin, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setTextColor('#111827')
      doc.text(`${encounter.diagnosisCode}  —  ${icd10Description || 'See encounter notes'}`, margin, y)
      y += 8
    }

    // ── CPT Code Table ────────────────────────────────────────────────────────
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#374151')
    doc.text('PROCEDURE CODES (CPT)', margin, y)
    y += 5

    if (cptCodes.length > 0) {
      // Table header
      doc.setFillColor('#f1f5f9')
      doc.rect(margin, y - 4, 170, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor('#374151')
      doc.text('Code', margin + 2, y)
      doc.text('Description', margin + 22, y)
      doc.text('Units', margin + 120, y)
      doc.text('Fee', margin + 138, y)
      doc.text('Total', margin + 154, y)
      y += 5

      doc.setFont('helvetica', 'normal')
      let grandTotal = 0
      for (const cpt of cptCodes) {
        if (y > 260) { doc.addPage(); y = 20 }
        doc.setTextColor('#111827')
        doc.text(cpt.code, margin + 2, y)
        const desc = doc.splitTextToSize(cpt.description, 90)
        doc.text(desc[0], margin + 22, y)
        doc.text(String(cpt.units), margin + 122, y)
        doc.text(`$${cpt.fee.toFixed(2)}`, margin + 136, y)
        doc.text(`$${cpt.total.toFixed(2)}`, margin + 152, y)
        grandTotal += cpt.total
        y += 5
        doc.setDrawColor('#f1f5f9')
        doc.line(margin, y - 1, 190, y - 1)
      }

      // Total line
      y += 2
      doc.setDrawColor('#0d9488')
      doc.setLineWidth(0.8)
      doc.line(margin + 130, y, 190, y)
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor('#0d9488')
      doc.text('TOTAL CHARGES:', margin + 118, y)
      doc.text(`$${grandTotal.toFixed(2)}`, margin + 152, y)
      y += 8
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor('#64748b')
      doc.text('No CPT codes calculated. Generate CPT codes from the Encounters dashboard.', margin, y)
      y += 8
    }

    doc.setDrawColor('#e2e8f0')
    doc.setLineWidth(0.5)
    doc.line(margin, y, 190, y)
    y += 6

    // ── SOAP Notes ────────────────────────────────────────────────────────────
    const addSection = (title: string, content: string | null | undefined) => {
      if (!content) return
      if (y > 245) { doc.addPage(); y = 20 }
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor('#0d9488')
      doc.text(title, margin, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor('#374151')
      const lines = doc.splitTextToSize(content, 170)
      for (const line of lines) {
        if (y > 265) { doc.addPage(); y = 20 }
        doc.text(line, margin, y)
        y += 4
      }
      y += 3
    }

    addSection('Chief Complaint', encounter.chiefComplaint as string)
    addSection('Subjective', encounter.subjectiveNotes as string)
    addSection('Objective', encounter.objectiveNotes as string)
    addSection('Assessment', encounter.assessment as string)
    addSection('Plan', encounter.plan as string)

    // ── MD Signature ──────────────────────────────────────────────────────────
    if (encounter.status === 'signed' || encounter.status === 'billed') {
      if (y > 240) { doc.addPage(); y = 20 }
      y += 4
      doc.setDrawColor('#e2e8f0')
      doc.line(margin, y, 190, y)
      y += 6
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor('#374151')
      doc.text('PHYSICIAN ATTESTATION & SIGNATURE', margin, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor('#111827')
      if (encounter.mdAttestation) {
        const attLines = doc.splitTextToSize(encounter.mdAttestation as string, 170)
        for (const line of attLines) {
          if (y > 270) { doc.addPage(); y = 20 }
          doc.text(line, margin, y)
          y += 4
        }
      }
      y += 3
      doc.setFont('helvetica', 'bold')
      doc.text(`Signed by: ${encounter.signedBy ?? '—'}`, margin, y)
      if (encounter.signedAt) {
        const signDate = new Date(encounter.signedAt as string | number).toLocaleString('en-US')
        doc.text(`Date: ${signDate}`, margin + 80, y)
      }
      y += 5
      // Signature line
      doc.setDrawColor('#374151')
      doc.setLineWidth(0.5)
      doc.line(margin, y, margin + 70, y)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor('#64748b')
      doc.text('Physician Signature', margin, y + 4)
    }

    // Status + billed
    if (encounter.status === 'billed' && encounter.billedAt) {
      if (y > 260) { doc.addPage(); y = 20 }
      y += 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor('#0d9488')
      doc.text(`✓ SUBMITTED TO INSURANCE: ${new Date(encounter.billedAt as string | number).toLocaleDateString('en-US')}`, margin, y)
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
    const datePrinted = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor('#94a3b8')
      doc.text(
        `HIPAA Compliant  ·  Confidential Patient Record  ·  Integrated Allergy Testing  ·  NPI: 1234567890`,
        pageW / 2, 285, { align: 'center' }
      )
      doc.text(
        `Date Printed: ${datePrinted}   |   Page ${i} of ${totalPages}`,
        pageW / 2, 290, { align: 'center' }
      )
    }

    const pdfBytes = doc.output('arraybuffer')
    const safeId = patientDisplayId.replace(/[^a-zA-Z0-9]/g, '')
    const encDateISO = encDate.toISOString().slice(0, 10)

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="superbill-${safeId}-${encDateISO}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Superbill PDF error:', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
