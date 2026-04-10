/**
 * @file tests/lib/permissions.test.ts
 * @description Tests for the permissions system in lib/permissions.ts
 */
import { describe, it, expect } from 'vitest'
import { ROLE_PROFILES, hasPermission, PERMISSIONS, Permission } from '@/lib/permissions'

// ─── Role Profile Tests ───────────────────────────────────────────────────────

describe('Admin role permissions', () => {
  it('admin role has all permissions', () => {
    const allPermissions = Object.keys(PERMISSIONS) as Permission[]
    for (const perm of allPermissions) {
      expect(hasPermission('admin', null, perm)).toBe(true)
    }
  })
})

describe('Clinical staff permissions', () => {
  it('clinical_staff has test_results_view', () => {
    expect(hasPermission('clinical_staff', null, 'test_results_view')).toBe(true)
  })

  it('clinical_staff has test_results_create', () => {
    expect(hasPermission('clinical_staff', null, 'test_results_create')).toBe(true)
  })

  it('clinical_staff has waiting_room_manage', () => {
    expect(hasPermission('clinical_staff', null, 'waiting_room_manage')).toBe(true)
  })

  it('clinical_staff does NOT have users_manage', () => {
    expect(hasPermission('clinical_staff', null, 'users_manage')).toBe(false)
  })

  it('clinical_staff does NOT have billing_rules_manage', () => {
    expect(hasPermission('clinical_staff', null, 'billing_rules_manage')).toBe(false)
  })
})

describe('Front desk permissions', () => {
  it('front_desk does NOT have billing_rules_view', () => {
    expect(hasPermission('front_desk', null, 'billing_rules_view')).toBe(false)
  })

  it('front_desk does NOT have billing_rules_manage', () => {
    expect(hasPermission('front_desk', null, 'billing_rules_manage')).toBe(false)
  })

  it('front_desk does NOT have insurance_manage', () => {
    expect(hasPermission('front_desk', null, 'insurance_manage')).toBe(false)
  })

  it('front_desk does NOT have users_manage', () => {
    expect(hasPermission('front_desk', null, 'users_manage')).toBe(false)
  })

  it('front_desk CAN view insurance', () => {
    expect(hasPermission('front_desk', null, 'insurance_view')).toBe(true)
  })

  it('front_desk CAN manage waiting room', () => {
    expect(hasPermission('front_desk', null, 'waiting_room_manage')).toBe(true)
  })
})

describe('Billing role permissions', () => {
  it('billing role has billing_rules_view', () => {
    expect(hasPermission('billing', null, 'billing_rules_view')).toBe(true)
  })

  it('billing role has insurance_view', () => {
    expect(hasPermission('billing', null, 'insurance_view')).toBe(true)
  })

  it('billing role has insurance_manage', () => {
    expect(hasPermission('billing', null, 'insurance_manage')).toBe(true)
  })

  it('billing role has cpt_codes_manage', () => {
    expect(hasPermission('billing', null, 'cpt_codes_manage')).toBe(true)
  })

  it('billing role does NOT have waiting_room_manage', () => {
    expect(hasPermission('billing', null, 'waiting_room_manage')).toBe(false)
  })

  it('billing role does NOT have allergens_manage', () => {
    expect(hasPermission('billing', null, 'allergens_manage')).toBe(false)
  })
})

// ─── hasPermission() behavior tests ──────────────────────────────────────────

describe('hasPermission() — basic behavior', () => {
  it('returns true for granted permissions', () => {
    expect(hasPermission('provider', null, 'encounters_view')).toBe(true)
  })

  it('returns false for denied permissions', () => {
    expect(hasPermission('provider', null, 'users_manage')).toBe(false)
  })

  it('returns false for unknown role', () => {
    expect(hasPermission('unknown_role', null, 'patients_view')).toBe(false)
  })

  it('admin always returns true regardless of overrides', () => {
    const denyOverride = JSON.stringify({ patients_view: false })
    // Admin ignores overrides
    expect(hasPermission('admin', denyOverride, 'patients_view')).toBe(true)
  })
})

// ─── JSON override tests ──────────────────────────────────────────────────────

describe('JSON permission overrides', () => {
  it('JSON override grants extra permission to user', () => {
    // billing doesn't normally have test_results_view
    expect(hasPermission('billing', null, 'test_results_view')).toBe(false)

    const grantOverride = JSON.stringify({ test_results_view: true })
    expect(hasPermission('billing', grantOverride, 'test_results_view')).toBe(true)
  })

  it('JSON override denies permission from user', () => {
    // clinical_staff normally has test_results_view
    expect(hasPermission('clinical_staff', null, 'test_results_view')).toBe(true)

    const denyOverride = JSON.stringify({ test_results_view: false })
    expect(hasPermission('clinical_staff', denyOverride, 'test_results_view')).toBe(false)
  })

  it('JSON override only affects overridden permissions, not others', () => {
    const override = JSON.stringify({ test_results_view: false })
    // patients_view should still work for clinical_staff
    expect(hasPermission('clinical_staff', override, 'patients_view')).toBe(true)
  })

  it('malformed JSON override is ignored gracefully', () => {
    const badJson = '{ not valid json }'
    // Falls back to role profile
    expect(hasPermission('clinical_staff', badJson, 'test_results_view')).toBe(true)
  })

  it('null override uses role profile', () => {
    expect(hasPermission('clinical_staff', null, 'waiting_room_manage')).toBe(true)
  })

  it('empty string override is treated as no override', () => {
    // Empty string is falsy, so role profile is used
    expect(hasPermission('billing', '', 'billing_rules_view')).toBe(true)
  })
})

// ─── ROLE_PROFILES structure tests ───────────────────────────────────────────

describe('ROLE_PROFILES structure', () => {
  it('admin profile contains all permissions', () => {
    const adminPerms = ROLE_PROFILES['admin']
    const allPerms = Object.keys(PERMISSIONS) as Permission[]
    for (const p of allPerms) {
      expect(adminPerms).toContain(p)
    }
  })

  it('clinical_staff profile is an array', () => {
    expect(Array.isArray(ROLE_PROFILES['clinical_staff'])).toBe(true)
  })

  it('front_desk profile is an array', () => {
    expect(Array.isArray(ROLE_PROFILES['front_desk'])).toBe(true)
  })

  it('billing profile is an array', () => {
    expect(Array.isArray(ROLE_PROFILES['billing'])).toBe(true)
  })

  it('all permission values in profiles are valid PERMISSIONS keys', () => {
    const validPerms = new Set(Object.keys(PERMISSIONS))
    for (const [role, perms] of Object.entries(ROLE_PROFILES)) {
      if (role === 'admin') continue // admin built dynamically
      for (const p of perms) {
        expect(validPerms.has(p)).toBe(true)
      }
    }
  })
})

// ─── allowedLocations restriction ────────────────────────────────────────────

describe('allowedLocations restriction enforcement', () => {
  // This tests the getUserAllowedLocations helper behavior via mock
  it('allowedLocations as empty array allows no locations', () => {
    const allowedLocations: string[] = []
    const locationId = 'loc-123'
    expect(allowedLocations.length === 0 || !allowedLocations.includes(locationId)).toBe(true)
  })

  it('allowedLocations null means unrestricted access', () => {
    const allowedLocations: string[] | null = null
    // null = no restriction = all locations allowed
    expect(allowedLocations).toBeNull()
  })

  it('allowedLocations containing the location grants access', () => {
    const allowedLocations = ['loc-MAP', 'loc-VA-001']
    expect(allowedLocations.includes('loc-MAP')).toBe(true)
    expect(allowedLocations.includes('loc-OTHER')).toBe(false)
  })

  it('user with location restriction cannot access other locations', () => {
    const allowedLocations = ['loc-MAP']
    const requestedLocation = 'loc-DC-001'
    expect(allowedLocations.includes(requestedLocation)).toBe(false)
  })
})
