/**
 * API fetch wrapper that auto-injects CSRF token on state-changing requests.
 * Use this instead of raw fetch() for POST/PUT/DELETE calls.
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
