/**
 * @file /api/audit — HIPAA audit log viewer
 * @description Read-only access to the AuditLog table for compliance review.
 *   GET — Return up to 50 recent audit events; supports ?patientId= filter.
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(patientId ? { patientId } : {}),
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('GET /api/audit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
