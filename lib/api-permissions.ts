/**
 * @file lib/api-permissions.ts — Permission gate helper for API routes
 * @description Call requirePermission() at the top of any route handler to enforce
 *   role-based access. Returns null if allowed, or a 401/403 NextResponse if denied.
 */
import { NextRequest, NextResponse } from 'next/server'
import { hasPermission, Permission } from './permissions'
import { verifySession } from '@/lib/auth/session'

export async function requirePermission(req: NextRequest, permission: Permission) {
  const session = await verifySession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRole = (session.role as string) ?? 'staff'

  if (userRole === 'admin') return null

  // Fetch per-user permission overrides from DB using raw SQL (Turso DateTime compatibility)
  const prisma = (await import('./db')).default
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT permissions FROM StaffUser WHERE id=? LIMIT 1`,
    session.id as string
  )
  const userPermissions = rows[0]?.permissions as string | null | undefined

  if (!hasPermission(userRole, userPermissions, permission)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}
