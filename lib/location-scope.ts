/**
 * Location scope enforcement for API routes.
 * If a user has `allowedLocations` set, all queries must be restricted to those IDs.
 */
import prisma from '@/lib/db'

interface SessionUser { id: string; role: string; }

/**
 * Returns the location IDs this user is allowed to access.
 * Returns null if unrestricted (all locations).
 */
export async function getUserLocationScope(user: SessionUser): Promise<string[] | null> {
  // Admins can optionally be scoped too — check allowedLocations for everyone
  try {
    const rows = await prisma.$queryRaw<Array<{ allowedLocations: string | null }>>`
      SELECT allowedLocations FROM StaffUser WHERE id = ${user.id} LIMIT 1
    `
    if (!rows[0]?.allowedLocations) return null // unrestricted
    const parsed = JSON.parse(rows[0].allowedLocations) as string[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null // on error, don't restrict
  }
}

/**
 * Given a requested locationId/practiceId and user scope,
 * returns the effective SQL WHERE clause fragment + values.
 * 
 * Usage:
 *   const { clause, values } = buildLocationClause(requestedLocId, requestedPracticeId, allowedLocIds)
 *   sql += clause ? ` AND ${clause}` : ''
 */
export function buildLocationClause(
  requestedLocationId: string | null,
  requestedPracticeId: string | null,
  allowedLocIds: string[] | null,
  tableAlias = ''
): { clause: string; values: unknown[] } {
  const col = tableAlias ? `${tableAlias}.locationId` : 'locationId'

  if (requestedLocationId) {
    // User requested a specific location — enforce scope
    if (allowedLocIds && !allowedLocIds.includes(requestedLocationId)) {
      // Requested location outside their scope — return nothing
      return { clause: `${col} = '__BLOCKED__'`, values: [] }
    }
    return { clause: `${col} = ?`, values: [requestedLocationId] }
  }

  if (requestedPracticeId) {
    // Practice-level filter — intersect with allowed locations
    if (allowedLocIds) {
      return {
        clause: `${col} IN (SELECT id FROM Location WHERE practiceId = ? AND deletedAt IS NULL AND id IN (${allowedLocIds.map(() => '?').join(',')}))`,
        values: [requestedPracticeId, ...allowedLocIds]
      }
    }
    return {
      clause: `${col} IN (SELECT id FROM Location WHERE practiceId = ? AND deletedAt IS NULL)`,
      values: [requestedPracticeId]
    }
  }

  // No filter requested — apply scope if restricted
  if (allowedLocIds) {
    return {
      clause: `${col} IN (${allowedLocIds.map(() => '?').join(',')})`,
      values: allowedLocIds
    }
  }

  return { clause: '', values: [] }
}
