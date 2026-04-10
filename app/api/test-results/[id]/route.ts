/**
 * @file /api/test-results/[id] — Update a single allergy test result
 * @description Partial update of a test result record (reaction, wheal, notes, readAt).
 *   PUT — Update test result fields by internal ID.
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(request, 'test_results_create')
  if (denied) return denied
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
    const now = new Date().toISOString()
    const readAtStr = readAt ? new Date(readAt).toISOString() : null

    // Build SET clause
    const sets: string[] = ['updatedAt = ?']
    const vals: unknown[] = [now]

    if (reaction !== undefined) { sets.push('reaction = ?'); vals.push(reaction) }
    if (wheal !== undefined) { sets.push('wheal = ?'); vals.push(wheal) }
    if (notes !== undefined) { sets.push('notes = ?'); vals.push(notes) }
    if (nurseName !== undefined) { sets.push('nurseName = ?'); vals.push(nurseName) }
    if (readAt !== undefined) { sets.push('readAt = ?'); vals.push(readAtStr) }

    await prisma.$executeRawUnsafe(
      `UPDATE AllergyTestResult SET ${sets.join(', ')} WHERE id = ?`,
      ...vals, id
    )

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT t.*, a.id as allergen_id, a.name as allergen_name, a.category as allergen_category
       FROM AllergyTestResult t
       LEFT JOIN Allergen a ON a.id = t.allergenId
       WHERE t.id = ?`, id
    )
    if (!rows[0]) {
      return NextResponse.json({ error: 'Test result not found' }, { status: 404 })
    }

    const testResult = {
      ...rows[0],
      allergen: rows[0].allergen_id ? {
        id: rows[0].allergen_id,
        name: rows[0].allergen_name,
        category: rows[0].allergen_category,
      } : null,
    }

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'AllergyTestResult',
        entityId: id,
        patientId: rows[0].patientId as string,
        details: `Updated test result for allergen ${rows[0].allergenId as string}`,
      },
    })

    return NextResponse.json(testResult, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('PUT /api/test-results/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
