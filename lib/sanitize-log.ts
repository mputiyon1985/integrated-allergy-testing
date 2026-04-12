/**
 * @file lib/sanitize-log.ts — Strip PHI from log messages
 * HIPAA requires PHI not appear in system logs
 */

const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g,           // SSN pattern
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Card numbers
  /dob[:\s]+[\d\/\-]+/gi,               // DOB patterns
  /date.of.birth[:\s]+[\d\/\-]+/gi,
]

export function sanitizeForLog(msg: unknown): string {
  let str = typeof msg === 'string' ? msg : JSON.stringify(msg)
  for (const pattern of PHI_PATTERNS) {
    str = str.replace(pattern, '[REDACTED]')
  }
  return str
}

export function logError(context: string, error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error)
  console.error(`[${context}]`, sanitizeForLog(msg))
}
