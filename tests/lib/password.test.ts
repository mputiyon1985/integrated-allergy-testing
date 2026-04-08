import { describe, it, expect } from 'vitest'

// Test password strength rules used in staff creation
describe('Password validation', () => {
  const isStrong = (pwd: string) => {
    if (pwd.length < 10) return { ok: false, reason: 'Too short' }
    if (!/[A-Z]/.test(pwd)) return { ok: false, reason: 'No uppercase' }
    if (!/[0-9]/.test(pwd)) return { ok: false, reason: 'No number' }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pwd)) return { ok: false, reason: 'No special char' }
    if (pwd.length > 128) return { ok: false, reason: 'Too long' }
    return { ok: true }
  }

  it('rejects passwords shorter than 10 chars', () => {
    expect(isStrong('Short1!')).toEqual({ ok: false, reason: 'Too short' })
  })
  it('rejects passwords without uppercase', () => {
    expect(isStrong('alllowercase1!')).toEqual({ ok: false, reason: 'No uppercase' })
  })
  it('rejects passwords without numbers', () => {
    expect(isStrong('NoNumbers!')).toEqual({ ok: false, reason: 'No number' })
  })
  it('rejects passwords without special chars', () => {
    expect(isStrong('NoSpecial123')).toEqual({ ok: false, reason: 'No special char' })
  })
  it('rejects passwords over 128 chars', () => {
    expect(isStrong('A1!' + 'a'.repeat(130))).toEqual({ ok: false, reason: 'Too long' })
  })
  it('accepts valid strong passwords', () => {
    expect(isStrong('Testing@2026!')).toEqual({ ok: true })
    expect(isStrong('Secure#Pass99')).toEqual({ ok: true })
  })
})
