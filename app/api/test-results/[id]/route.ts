/**
 * @file /api/test-results/[id] — Update a single allergy test result
 * @description Partial update of a test result record (reaction, wheal, notes, readAt).
 *   PUT — Update test result fields by internal ID.
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json() as {
      reaction?: number
      wheal?: string
      notes?: string
      nurseName?: string
      readAt?: string
    }

    const { reaction, wheal, notes, nurseName, readAt } = body

    const testResult = await prisma.allergyTestResult.update({
      where: { id },
      data: {
        ...(reaction !== undefined ? { reaction } : {}),
        ...(wheal !== undefined ? { wheal } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(nurseName !== undefined ? { nurseName } : {}),
        ...(readAt !== undefined ? { readAt: new Date(readAt) } : {}),
      },
      include: { allergen: true },
    })

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'AllergyTestResult',
        entityId: testResult.id,
        patientId: testResult.patientId,
        details: `Updated test result for allergen ${testResult.allergenId}`,
      },
    })

    return NextResponse.json(testResult, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('PUT /api/test-results/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
