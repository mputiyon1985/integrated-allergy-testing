/**
 * @file /api/patients — Patient list and creation
 * @description Manages the patient roster.
 *   GET  — List all active patients; supports ?search= query param.
 *   POST — Create a new patient record (name, dob required).
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

const createPatientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be YYYY-MM-DD'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  physician: z.string().max(200).optional(),
  clinicLocation: z.string().max(200).optional(),
  diagnosis: z.string().max(500).optional(),
  insuranceId: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
})

export async function GET(request: NextRequest) {
  const denied = await requirePermission(request, 'patients_view')
  if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const locationId = searchParams.get('locationId')

    const patients = await prisma.patient.findMany({
      where: {
        deletedAt: null,
        // Only show IAT patients (patientId starts with PAT-)
        patientId: { startsWith: 'PAT-' },
        ...(locationId ? { locationId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { patientId: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        patientId: true,
        name: true,
        dob: true,
        status: true,
        doctorId: true,
        clinicLocation: true,
        physician: true,
      },
      orderBy: [{ name: 'asc' }],
    })

    return NextResponse.json(patients, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('GET /api/patients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await requirePermission(request, 'patients_create')
  if (denied) return denied
  try {
    const body = await request.json()

    const result = createPatientSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { name, dob } = result.data

    const patientId = `PAT-${Date.now().toString(36).toUpperCase()}`

    const patient = await prisma.patient.create({
      data: {
        patientId,
        name,
        dob: new Date(dob),
        email: result.data.email,
        phone: result.data.phone,
        homePhone: (body as Record<string, string>).homePhone || null,
        street: (body as Record<string, string>).street || null,
        city: (body as Record<string, string>).city || null,
        state: (body as Record<string, string>).state || null,
        zip: (body as Record<string, string>).zip || null,
        physician: result.data.physician,
        clinicLocation: result.data.clinicLocation,
        diagnosis: result.data.diagnosis,
        insuranceId: result.data.insuranceId,
        insuranceProvider: (body as Record<string, string>).insuranceProvider || null,
        insuranceGroup: (body as Record<string, string>).insuranceGroup || null,
        emergencyName: (body as Record<string, string>).emergencyName || null,
        emergencyPhone: (body as Record<string, string>).emergencyPhone || null,
        emergencyRelation: (body as Record<string, string>).emergencyRelation || null,
        notes: result.data.notes,
        doctorId: (body as { doctorId?: string }).doctorId,
      },
    })

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Patient',
        entityId: patient.id,
        patientId: patient.id,
        details: `Created patient ${patientId}: ${name}`,
      },
    })

    return NextResponse.json(patient, { status: 201, headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('POST /api/patients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
