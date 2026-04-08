/**
 * @file /api/test-results — Allergy test result list and creation
 * @description Manages allergy test results across patients.
 *   GET  — List test results; supports ?patientId= filter.
 *   POST — Record a new test result (patientId, allergenId, testType, reaction required).
 *          testType must be 'scratch' or 'intradermal'; reaction must be 0–4.
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
    const body = await request.json() as {
      patientId?: string
      allergenId?: string
      testType?: string
      reaction?: number
      wheal?: string
      notes?: string
      nurseName?: string
    }

    const { patientId, allergenId, testType, reaction, wheal, notes, nurseName } = body

    if (!patientId || !allergenId || !testType || reaction === undefined) {
      return NextResponse.json(
        { error: 'patientId, allergenId, testType, and reaction are required' },
        { status: 400 }
      )
    }

    if (!['scratch', 'intradermal'].includes(testType)) {
      return NextResponse.json(
        { error: 'testType must be scratch or intradermal' },
        { status: 400 }
      )
    }

    if (reaction < 0 || reaction > 4) {
      return NextResponse.json(
        { error: 'reaction must be between 0 and 4' },
        { status: 400 }
      )
    }

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
