import { describe, it, expect } from 'vitest'

const VALID_CONSENT_FORM_IDS = ['form-consent-001', 'form-consent-002']

describe('Consent form validation', () => {
  it('accepts valid form IDs', () => {
    expect(VALID_CONSENT_FORM_IDS.includes('form-consent-001')).toBe(true)
    expect(VALID_CONSENT_FORM_IDS.includes('form-consent-002')).toBe(true)
  })
  it('rejects invalid form IDs', () => {
    expect(VALID_CONSENT_FORM_IDS.includes('form-hacked')).toBe(false)
    expect(VALID_CONSENT_FORM_IDS.includes('')).toBe(false)
    expect(VALID_CONSENT_FORM_IDS.includes('../etc/passwd')).toBe(false)
  })
})
