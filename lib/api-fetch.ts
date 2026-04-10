/**
 * API fetch wrapper that automatically injects the CSRF token on state-changing requests.
 *
 * Reads `iat_csrf` from `document.cookie` and adds it as an `X-CSRF-Token` header
 * for POST, PUT, DELETE, and PATCH requests. GET requests are passed through unchanged.
 *
 * Use this instead of raw `fetch()` for all client-side API calls that mutate state.
 *
 * @param url - The request URL (relative or absolute).
 * @param options - Standard `RequestInit` options (method, headers, body, etc.).
 * @returns A `Promise<Response>` identical to the native `fetch` return.
 *
 * @example
 * ```ts
 * // POST with CSRF token injected automatically:
 * const res = await apiFetch('/api/patients', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ name: 'Jane Doe', dob: '1990-01-15' }),
 * })
 * const data = await res.json()
 *
 * // GET — no CSRF header added:
 * const res = await apiFetch('/api/patients?search=doe')
 * ```
 */
export function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const method = (options?.method ?? 'GET').toUpperCase()
  
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfToken = (() => {
      try {
        return document.cookie
          .split('; ')
          .find(row => row.startsWith('iat_csrf='))
          ?.split('=')[1] ?? ''
      } catch { return '' }
    })()
    
    return fetch(url, {
      ...options,
      headers: {
        ...(options?.headers ?? {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
    })
  }
  
  return fetch(url, options)
}
