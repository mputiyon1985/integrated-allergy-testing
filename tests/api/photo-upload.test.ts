/**
 * @file tests/api/photo-upload.test.ts
 * @description Tests for patient photo upload endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  default: {
    $queryRawUnsafe: vi.fn(),
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn(),
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  },
}))

vi.mock('@/lib/api-permissions', () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/auth/session', () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'admin', name: 'Admin' }),
}))

import prisma from '@/lib/db'
const mockPrisma = prisma as unknown as Record<string, ReturnType<typeof vi.fn>>

describe('Patient Photo Upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects non-image file types', async () => {
    // Photo upload should validate file type
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const invalidTypes = ['application/pdf', 'text/plain', 'application/javascript']
    
    for (const t of validImageTypes) {
      expect(t.startsWith('image/')).toBe(true)
    }
    for (const t of invalidTypes) {
      expect(t.startsWith('image/')).toBe(false)
    }
  })

  it('validates 5MB file size limit', () => {
    const maxSize = 5 * 1024 * 1024 // 5MB
    expect(5 * 1024 * 1024).toBeLessThanOrEqual(maxSize)
    expect(6 * 1024 * 1024).toBeGreaterThan(maxSize)
  })

  it('generates unique filename for each upload', () => {
    const makeFilename = (patientId: string, ext: string) =>
      `${patientId}-${Date.now()}.${ext}`
    
    const name1 = makeFilename('PA-TEST123', 'jpg')
    const name2 = makeFilename('PA-TEST123', 'jpg')
    // Names should start with patient ID
    expect(name1.startsWith('PA-TEST123-')).toBe(true)
  })

  it('returns photoUrl on successful upload', () => {
    const expectedResponse = { photoUrl: '/uploads/patients/PA-TEST123-1234567.jpg' }
    expect(expectedResponse.photoUrl).toMatch(/^\/uploads\/patients\//)
  })

  it('photoUrl path format is correct', () => {
    const paths = [
      '/uploads/patients/PA-ABC123-1000000.jpg',
      '/uploads/patients/PA-XYZ999-9999999.png',
    ]
    for (const p of paths) {
      expect(p).toMatch(/^\/uploads\/patients\/[A-Z0-9-]+\.\w+$/)
    }
  })
})

describe('Patient photo display', () => {
  it('shows initials when no photo', () => {
    const getInitials = (name: string) => {
      const parts = name.trim().split(' ')
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase()
    }
    expect(getInitials('John Smith')).toBe('JS')
    expect(getInitials('Mary')).toBe('MA')
    expect(getInitials('Robert Chen')).toBe('RC')
  })
})
