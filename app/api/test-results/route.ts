/**
 * @file /api/test-results — Allergy test result list and creation
 * @description Manages allergy test results across patients.
 *   GET  — List test results; supports ?patientId= filter.
 *   POST — Record a new test result (patientId, allergenId, testType, reaction required).
 *          testType must be 'scratch' or 'intradermal'; reaction must be 0–5.
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export const dynamic = 'force-dynamic'

const createTestResultSchema = z.object({
  patientId: z.string().min(1),
  allergenId: z.string().min(1),
  testType: z.enum(['scratch', 'intradermal']),
  reaction: z.number().int().min(0).max(5),
  wheal: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
  nurseName: z.string().max(200).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')

    const testResults = await prisma.allergyTestResult.findMany({
      where: {
        active: true,
        ...(patientId ? { patientId } : {}),
      },
      include: {
        allergen: true,
        patient: {
          select: {
            id: true,
            patientId: true,
            name: true,
          },
        },
      },
      orderBy: { testedAt: 'desc' },
    })

    return NextResponse.json(testResults, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('GET /api/test-results error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const result = createTestResultSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { patientId, allergenId, testType, reaction, wheal, notes, nurseName } = result.data

    const testResult = await prisma.allergyTestResult.create({
      data: {
        patientId,
        allergenId,
        testType,
        reaction,
        wheal,
        notes,
        nurseName,
      },
      include: { allergen: true },
    })

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'AllergyTestResult',
        entityId: testResult.id,
        patientId,
        details: `Created ${testType} test result for allergen ${allergenId}, reaction: ${reaction}`,
      },
    })

    return NextResponse.json(testResult, { status: 201, headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('POST /api/test-results error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
