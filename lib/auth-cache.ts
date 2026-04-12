/**
 * Client-side auth/me cache — prevents multiple components from each
 * firing /api/auth/me on the same page load (cold start × N = pain).
 */

type AuthUser = {
  id: string;
  userId?: string;
  email: string;
  name: string;
  role: string;
  defaultLocationId?: string;
};

let _promise: Promise<AuthUser | null> | null = null;
let _result: AuthUser | null = null;
let _fetchedAt = 0;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getAuthUser(): Promise<AuthUser | null> {
  const now = Date.now();

  // Return cached result if fresh
  if (_result && now - _fetchedAt < TTL_MS) {
    return Promise.resolve(_result);
  }

  // De-duplicate concurrent calls — return same promise
  if (_promise) return _promise;

  _promise = fetch('/api/auth/me')
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      const u = data?.user ?? data;
      _result = u?.id || u?.userId ? u : null;
      _fetchedAt = Date.now();
      _promise = null;
      // Sync to localStorage for fast reads
      if (_result) {
        try { localStorage.setItem('iat_user', JSON.stringify(_result)); } catch {}
      }
      return _result;
    })
    .catch(() => {
      _promise = null;
      return null;
    });

  return _promise;
}

export function clearAuthCache() {
  _result = null;
  _promise = null;
  _fetchedAt = 0;
}
