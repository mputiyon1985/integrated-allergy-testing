/**
 * GET /api/email/logs — email send history with filters
 * ?patientId=&status=&from=&to=
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = await requirePermission(request, 'patients_view')
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const search = searchParams.get('search')

    let sql = `SELECT l.*, t.name as templateName FROM EmailLog l
               LEFT JOIN EmailTemplate t ON t.id = l.templateId
               WHERE 1=1`
    const values: unknown[] = []

    if (patientId) { sql += ' AND l.patientId = ?'; values.push(patientId) }
    if (status) { sql += ' AND l.status = ?'; values.push(status) }
    if (from) { sql += ' AND l.createdAt >= ?'; values.push(from) }
    if (to) { sql += ' AND l.createdAt <= ?'; values.push(to + 'T23:59:59') }
    if (search) {
      sql += ' AND (l.patientEmail LIKE ? OR l.subject LIKE ?)'
      const s = `%${search}%`
      values.push(s, s)
    }

    sql += ' ORDER BY l.createdAt DESC LIMIT 200'

    const logs = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...values)
    return NextResponse.json({ logs }, { headers: HIPAA_HEADERS })
  } catch (error) {
    console.error('GET /api/email/logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
