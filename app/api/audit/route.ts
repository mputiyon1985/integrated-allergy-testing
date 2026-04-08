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
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 50

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(patientId ? { patientId } : {}),
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json(logs, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('GET /api/audit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
