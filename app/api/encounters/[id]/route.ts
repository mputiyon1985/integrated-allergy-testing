import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const encounter = await prisma.encounter.findFirst({ where: { id, deletedAt: null } })
    if (!encounter) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(encounter, { headers: HIPAA_HEADERS })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json() as Record<string, unknown>
    const data: Record<string, unknown> = {}
    const fields = ['chiefComplaint','subjectiveNotes','objectiveNotes','assessment','plan','status','doctorId','doctorName','nurseId','nurseName','appointmentId','followUpDays']
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f]
    if (body.encounterDate) data.encounterDate = new Date(String(body.encounterDate))
    const encounter = await prisma.encounter.update({ where: { id }, data })
    prisma.auditLog.create({ data: { action: 'ENCOUNTER_UPDATED', entity: 'Encounter', entityId: id, patientId: encounter.patientId }}).catch(()=>{})
    return NextResponse.json({ encounter }, { headers: HIPAA_HEADERS })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const encounter = await prisma.encounter.update({ where: { id }, data: { deletedAt: new Date() } })
    prisma.auditLog.create({ data: { action: 'ENCOUNTER_DELETED', entity: 'Encounter', entityId: id, patientId: encounter.patientId }}).catch(()=>{})
    return NextResponse.json({ ok: true })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
