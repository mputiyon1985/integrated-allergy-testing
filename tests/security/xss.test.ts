import { describe, it, expect } from 'vitest'

function sanitize(template: string): string {
  return template
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\bon\w+\s*=/gi, 'data-blocked=')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/vbscript\s*:/gi, 'blocked:')
    .replace(/data\s*:\s*text\s*\/\s*html/gi, 'blocked:')
}

describe('XSS sanitization', () => {
  it('strips script tags', () => {
    expect(sanitize('<script>alert(1)</script>')).not.toContain('<script>')
  })
  it('strips iframes', () => {
    expect(sanitize('<iframe src="evil.com"></iframe>')).not.toContain('<iframe>')
  })
  it('blocks onclick handlers', () => {
    expect(sanitize('<div onclick="evil()">')).toContain('data-blocked=')
  })
  it('blocks javascript: hrefs', () => {
    expect(sanitize('<a href="javascript:alert(1)">')).toContain('blocked:')
  })
  it('blocks vbscript:', () => {
    expect(sanitize('<a href="vbscript:msgbox(1)">')).toContain('blocked:')
  })
  it('preserves safe HTML', () => {
    const safe = '<h2>Consent Form</h2><p>Please read carefully.</p>'
    expect(sanitize(safe)).toBe(safe)
  })
})
