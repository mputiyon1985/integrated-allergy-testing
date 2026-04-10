/**
 * Reads active location/practice from localStorage and returns query param string.
 * Use this instead of inline localStorage reads scattered across the codebase.
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
