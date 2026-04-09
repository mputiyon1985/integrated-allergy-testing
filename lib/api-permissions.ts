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

  // Fetch per-user permission overrides from DB
  const prisma = (await import('./db')).default
  const user = await prisma.staffUser.findUnique({
    where: { id: session.id as string },
    select: { permissions: true },
  })

  if (!hasPermission(userRole, user?.permissions, permission)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}
