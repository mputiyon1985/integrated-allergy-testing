/**
 * @file lib/pdf.ts — PDF generation utilities
 * @description Generates patient-facing PDF documents using jsPDF.
 *   - `generateConsentPDF` — Patient consent form with optional signature image.
 *   - `generateTestResultsPDF` — Tabular allergy test results report.
 *   Both functions return a Blob suitable for streaming via NextResponse.
 * @usage `import { generateConsentPDF, generateTestResultsPDF } from '@/lib/pdf'`
 */
import { jsPDF } from 'jspdf'

export function generateConsentPDF(
  patient: {
    firstName: string
    lastName: string
    honorific?: string | null
    dob: Date | string
    email?: string | null
    patientId: string
  },
  signatureBase64?: string
): Blob {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(18)
  doc.setTextColor('#0055A5')
  doc.text('Integrated Allergy Testing', 105, 20, { align: 'center' })
  doc.setFontSize(14)
  doc.setTextColor('#000000')
  doc.text('Patient Consent Form', 105, 30, { align: 'center' })

  // Patient info
  doc.setFontSize(11)
  const name = [patient.honorific, patient.firstName, patient.lastName].filter(Boolean).join(' ')
  doc.text(`Patient: ${name}`, 20, 50)
  doc.text(`Patient ID: ${patient.patientId}`, 20, 58)
  doc.text(`DOB: ${new Date(patient.dob).toLocaleDateString()}`, 20, 66)
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 74)

  // Consent text
  doc.setFontSize(10)
  const consentText = [
    'I hereby consent to allergy testing procedures performed by Integrated Allergy Testing staff.',
    'I understand that allergy testing involves exposure to allergens that may cause reactions.',
    'I have been informed of the risks and benefits of allergy testing.',
    'I authorize the release of my allergy test results to my referring physician.',
  ]
  let y = 90
  consentText.forEach((line) => {
    doc.text(line, 20, y, { maxWidth: 170 })
    y += 14
  })

  // Signature
  if (signatureBase64) {
    doc.text('Patient Signature:', 20, y + 10)
    doc.addImage(signatureBase64, 'PNG', 20, y + 15, 80, 30)
  } else {
    doc.line(20, y + 30, 100, y + 30)
    doc.text('Patient Signature', 20, y + 36)
  }
  doc.line(120, y + 30, 190, y + 30)
  doc.text('Date', 120, y + 36)

  return doc.output('blob')
}

export function generateTestResultsPDF(
  patient: {
    firstName: string
    lastName: string
    honorific?: string | null
    patientId: string
    dob: Date | string
  },
  results: Array<{
    allergenName: string
    testType: string
    reaction: number
    wheal?: string | null
    testedAt: Date | string
  }>
): Blob {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.setTextColor('#0055A5')
  doc.text('Integrated Allergy Testing', 105, 20, { align: 'center' })
  doc.setFontSize(14)
  doc.setTextColor('#000000')
  doc.text('Allergy Test Results', 105, 30, { align: 'center' })

  const name = [patient.honorific, patient.firstName, patient.lastName].filter(Boolean).join(' ')
  doc.setFontSize(11)
  doc.text(`Patient: ${name}`, 20, 45)
  doc.text(`Patient ID: ${patient.patientId}`, 20, 53)
  doc.text(`Test Date: ${new Date().toLocaleDateString()}`, 20, 61)

  // Table header
  let y = 75
  doc.setFillColor('#0055A5')
  doc.rect(20, y, 170, 8, 'F')
  doc.setTextColor('#FFFFFF')
  doc.setFontSize(9)
  doc.text('Allergen', 22, y + 5.5)
  doc.text('Type', 90, y + 5.5)
  doc.text('Reaction (0-4)', 120, y + 5.5)
  doc.text('Wheal (mm)', 160, y + 5.5)
  y += 10

  doc.setTextColor('#000000')
  results.forEach((r, i) => {
    if (i % 2 === 0) {
      doc.setFillColor('#F0F9FF')
      doc.rect(20, y - 2, 170, 8, 'F')
    }
    doc.text(r.allergenName.slice(0, 35), 22, y + 4)
    doc.text(r.testType, 90, y + 4)
    doc.text(String(r.reaction), 135, y + 4)
    doc.text(r.wheal || '—', 165, y + 4)
    y += 8
    if (y > 270) {
      doc.addPage()
      y = 20
    }
  })

  return doc.output('blob')
}
