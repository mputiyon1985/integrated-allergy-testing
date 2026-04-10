/**
 * @file /api/kiosk/update-patient — Kiosk patient info update
 * @description Allows kiosk to update limited patient fields (phone, email, address, insurance).
 *   Only updates specific safe fields — cannot change name, DOB, status, physician, etc.
 *   No auth required (kiosk-facing) but validates patientId exists.
 * @security Public kiosk endpoint — field allowlist prevents privilege escalation
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export const dynamic = 'force-dynamic'

// Only these fields can be updated from the kiosk (strict allowlist)
const ALLOWED_FIELDS = ['phone', 'email', 'insuranceId', 'insuranceProvider', 'insuranceGroup', 'emergencyName', 'emergencyPhone', 'emergencyRelation', 'notes'] as const
type AllowedField = typeof ALLOWED_FIELDS[number]

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as { patientId?: string } & Partial<Record<AllowedField, string>>
    const { patientId, ...updates } = body

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    // Verify patient exists
    const patientRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM Patient WHERE id = ? AND deletedAt IS NULL LIMIT 1`, patientId
    )
    const patient = patientRows[0] ?? null
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Only apply allowed fields
    const safeUpdates: Partial<Record<AllowedField, string>> = {}
    for (const field of ALLOWED_FIELDS) {
      if (field in updates && typeof updates[field] === 'string') {
        safeUpdates[field] = String(updates[field]).slice(0, 500) // cap length
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ ok: true, message: 'Nothing to update' })
    }

    // Build raw SQL update from safe fields
    const fieldNames = Object.keys(safeUpdates) as AllowedField[]
    const setClauses = fieldNames.map(f => `${f} = ?`).join(', ')
    const fieldValues = fieldNames.map(f => safeUpdates[f])
    const now = new Date().toISOString()
    await prisma.$executeRawUnsafe(
      `UPDATE Patient SET ${setClauses}, updatedAt = ? WHERE id = ?`,
      ...fieldValues, now, patientId
    )

    // Audit log (non-blocking)
    prisma.auditLog.create({
      data: {
        action: 'KIOSK_INFO_UPDATE',
        entity: 'Patient',
        entityId: patientId,
        patientId,
        details: `Kiosk updated fields: ${Object.keys(safeUpdates).join(', ')}`,
      },
    }).catch(() => {})

    return NextResponse.json({ ok: true }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('PUT /api/kiosk/update-patient error:', err)
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 })
  }
}
