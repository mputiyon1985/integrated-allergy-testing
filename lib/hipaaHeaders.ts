/**
 * @file lib/hipaaHeaders.ts — HIPAA-compliant HTTP response headers
 * @description Defines the standard set of security headers required on all API responses
 *   that return Protected Health Information (PHI).
 *   Add to NextResponse via: `NextResponse.json(data, { headers: HIPAA_HEADERS })`
 *   For streaming/binary responses: spread into headers object `{ ...HIPAA_HEADERS }`
 * @usage `import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'`
 */
export const HIPAA_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
} as const
