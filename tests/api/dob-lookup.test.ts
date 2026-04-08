import { describe, it, expect } from 'vitest'

function validateDOB(dob: string): string | null {
  const d = new Date(dob)
  if (isNaN(d.getTime())) return 'Invalid date'
  const year = d.getFullYear()
  const currentYear = new Date().getFullYear()
  if (year < 1900) return 'Year too old'
  if (year > currentYear) return 'Year in future'
  return null
}

describe('DOB validation', () => {
  it('accepts valid DOBs', () => {
    expect(validateDOB('1990-05-15')).toBeNull()
    expect(validateDOB('1967-07-15')).toBeNull()
  })
  it('rejects year 0001', () => {
    expect(validateDOB('0001-01-01')).toBe('Year too old')
  })
  it('rejects future dates', () => {
    expect(validateDOB('2050-01-01')).toBe('Year in future')
  })
  it('rejects invalid strings', () => {
    expect(validateDOB('not-a-date')).toBe('Invalid date')
  })
})
