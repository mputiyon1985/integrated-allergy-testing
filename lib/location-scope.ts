/**
 * Location scope enforcement for API routes.
 * If a user has `allowedLocations` set, all queries must be restricted to those IDs.
 */
import prisma from '@/lib/db'

interface SessionUser { id: string; role: string; }

/**
 * Returns the location IDs this user is allowed to access.
 * Returns `null` if the user is unrestricted (access to all locations).
 *
 * Queries `StaffUser.allowedLocations` (a JSON-encoded string array).
 * On DB error, fails open (returns `null`) to avoid locking out users.
 *
 * @param user - The authenticated session user `{ id, role }`.
 * @returns Array of allowed location ID strings, or `null` for unrestricted access.
 *
 * @example
 * ```ts
 * const scope = await getUserLocationScope({ id: session.id, role: session.role })
 * if (scope) {
 *   // Restrict query to scope
 * }
 * ```
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
 * Builds a parameterised SQL WHERE clause fragment enforcing location-scope access control.
 *
 * Combines an explicit location/practice filter with the per-user allowed-location scope.
 * Returns a `clause` string and `values` array suitable for `$queryRawUnsafe`.
 *
 * @param requestedLocationId - Specific location ID requested by the caller, or `null`.
 * @param requestedPracticeId - Practice ID filter (expands to all locations in practice), or `null`.
 * @param allowedLocIds - Array of location IDs the user may access (`null` = unrestricted).
 * @param tableAlias - Optional SQL table alias prefix for the `locationId` column.
 * @returns `{ clause: string; values: unknown[] }` — append to SQL with `AND ${clause}`.
 *
 * @example
 * ```ts
 * const { clause, values } = buildLocationClause('loc-001', null, null)
 * // clause = 'locationId = ?', values = ['loc-001']
 *
 * const { clause } = buildLocationClause('loc-out', null, ['loc-in'])
 * // clause contains '__BLOCKED__' — query will return no rows
 * ```
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
