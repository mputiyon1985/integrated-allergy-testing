/**
 * @file /api/audit — HIPAA audit log viewer
 * @description Read-only access to the AuditLog table for compliance review.
 *   GET — Return up to 50 recent audit events; supports ?patientId= filter.
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')
    const action = searchParams.get('action')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 200

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(patientId ? { patientId } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Enrich with patient name where available (non-fatal)
    const patientIds = [...new Set(logs.filter(l => l.patientId).map(l => l.patientId!))]
    let patientMap: Record<string, string> = {}
    if (patientIds.length > 0) {
      try {
        const placeholders = patientIds.map(() => '?').join(',')
        const patients = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; patientId: string | null }>>(
          `SELECT id, name, patientId FROM Patient WHERE id IN (${placeholders})`,
          ...patientIds
        )
        patientMap = Object.fromEntries(patients.map(p => [p.id, `${p.name} (${p.patientId ?? p.id.slice(0, 8)})`]))
      } catch { /* non-fatal */ }
    }

    const enriched = logs.map(l => ({
      ...l,
      patientName: l.patientId ? patientMap[l.patientId] ?? null : null,
    }))

    return NextResponse.json(enriched, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('GET /api/audit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
