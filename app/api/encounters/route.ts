import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  const locationId = searchParams.get('locationId')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  try {
    const encounters = await prisma.encounter.findMany({
      where: {
        ...(patientId ? { patientId } : {}),
        ...(locationId ? { locationId } : {}),
        deletedAt: null,
      },
      orderBy: { encounterDate: 'desc' },
      take: limit,
    })
    return NextResponse.json({ encounters }, { headers: HIPAA_HEADERS })
  } catch (err) { console.error(err); return NextResponse.json({ encounters: [] }) }
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, 'encounters_create')
  if (denied) return denied
  try {
    const body = await req.json() as Record<string, unknown>
    if (!body.patientId || !body.chiefComplaint) return NextResponse.json({ error: 'patientId and chiefComplaint required' }, { status: 400 })
    const encounter = await prisma.encounter.create({ data: {
      patientId: String(body.patientId),
      chiefComplaint: String(body.chiefComplaint),
      encounterDate: body.encounterDate ? new Date(String(body.encounterDate)) : new Date(),
      doctorId: body.doctorId ? String(body.doctorId) : null,
      doctorName: body.doctorName ? String(body.doctorName) : null,
      nurseId: body.nurseId ? String(body.nurseId) : null,
      nurseName: body.nurseName ? String(body.nurseName) : null,
      appointmentId: body.appointmentId ? String(body.appointmentId) : null,
      subjectiveNotes: body.subjectiveNotes ? String(body.subjectiveNotes) : null,
      objectiveNotes: body.objectiveNotes ? String(body.objectiveNotes) : null,
      assessment: body.assessment ? String(body.assessment) : null,
      plan: body.plan ? String(body.plan) : null,
      followUpDays: body.followUpDays ? Number(body.followUpDays) : null,
      status: body.status ? String(body.status) : 'open',
    }})
    prisma.auditLog.create({ data: { action: 'ENCOUNTER_CREATED', entity: 'Encounter', entityId: encounter.id, patientId: encounter.patientId, details: `Chief complaint: ${encounter.chiefComplaint}` }}).catch(()=>{})
    return NextResponse.json({ encounter }, { status: 201, headers: HIPAA_HEADERS })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed to create encounter' }, { status: 500 }) }
}
