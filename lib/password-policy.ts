/**
 * @file lib/password-policy.ts — HIPAA-aligned password validation
 * Requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 number
 */

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []
  if (password.length < 8)           errors.push('At least 8 characters required')
  if (!/[A-Z]/.test(password))       errors.push('At least 1 uppercase letter required')
  if (!/[a-z]/.test(password))       errors.push('At least 1 lowercase letter required')
  if (!/[0-9]/.test(password))       errors.push('At least 1 number required')
  return { valid: errors.length === 0, errors }
}

/** Zod-compatible password schema string */
export const PASSWORD_RULES = 'min 8 characters, 1 uppercase, 1 lowercase, 1 number'
