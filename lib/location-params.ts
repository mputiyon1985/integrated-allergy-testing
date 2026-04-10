/**
 * Reads the active location or practice filter from `localStorage` and returns
 * a URL query parameter string ready to append to API calls.
 *
 * Priority:
 * 1. `iat_active_location` → returns `?locationId=<id>` (or `&locationId=<id>`)
 * 2. `iat_active_practice_filter` → returns `?practiceId=<id>` (only when no location set)
 * 3. Neither set → returns `''`
 *
 * Gracefully returns `''` if `localStorage` is unavailable (SSR / non-browser environments).
 *
 * @param prefix - Query string prefix character. Use `'?'` for the first param,
 *   `'&'` when appending to an existing query string. Defaults to `'?'`.
 * @returns A URL-encoded query param string (e.g. `'?locationId=loc-001'`) or `''`.
 *
 * @example
 * ```ts
 * // When iat_active_location = 'loc-map-001':
 * const params = getLocationParam()         // '?locationId=loc-map-001'
 * const params = getLocationParam('&')      // '&locationId=loc-map-001'
 *
 * // In a fetch call:
 * const res = await apiFetch(`/api/patients${getLocationParam()}`)
 * ```
 */
export function getLocationParam(prefix: '?' | '&' = '?'): string {
  try {
    const loc = localStorage.getItem('iat_active_location')
    const practice = !loc ? localStorage.getItem('iat_active_practice_filter') : ''
    if (loc) return `${prefix}locationId=${encodeURIComponent(loc)}`
    if (practice) return `${prefix}practiceId=${encodeURIComponent(practice)}`
    return ''
  } catch { return '' }
}
