export const PERMISSIONS = {
  // Patients
  patients_view: 'patients_view',
  patients_create: 'patients_create',
  patients_edit: 'patients_edit',
  patients_delete: 'patients_delete',
  // Clinical
  test_results_view: 'test_results_view',
  test_results_create: 'test_results_create',
  allergens_view: 'allergens_view',
  allergens_manage: 'allergens_manage',
  vial_prep_view: 'vial_prep_view',
  vial_prep_manage: 'vial_prep_manage',
  dosing_view: 'dosing_view',
  dosing_administer: 'dosing_administer',
  // Encounters
  encounters_view: 'encounters_view',
  encounters_create: 'encounters_create',
  encounters_edit: 'encounters_edit',
  // Scheduling
  appointments_view: 'appointments_view',
  appointments_create: 'appointments_create',
  appointments_edit: 'appointments_edit',
  appointments_delete: 'appointments_delete',
  // Waiting Room
  waiting_room_view: 'waiting_room_view',
  waiting_room_manage: 'waiting_room_manage',
  // Billing & Insurance
  insurance_view: 'insurance_view',
  insurance_manage: 'insurance_manage',
  billing_rules_view: 'billing_rules_view',
  billing_rules_manage: 'billing_rules_manage',
  cpt_codes_view: 'cpt_codes_view',
  cpt_codes_manage: 'cpt_codes_manage',
  icd10_view: 'icd10_view',
  icd10_manage: 'icd10_manage',
  // Forms & Consent
  forms_view: 'forms_view',
  forms_manage: 'forms_manage',
  consent_view: 'consent_view',
  // Videos
  videos_view: 'videos_view',
  videos_manage: 'videos_manage',
  // Admin
  users_view: 'users_view',
  users_manage: 'users_manage',
  audit_log_view: 'audit_log_view',
  settings_view: 'settings_view',
  settings_manage: 'settings_manage',
  doctors_manage: 'doctors_manage',
  nurses_manage: 'nurses_manage',
  locations_manage: 'locations_manage',
  practices_manage: 'practices_manage',
  // Reports
  reports_view: 'reports_view',
} as const

export type Permission = keyof typeof PERMISSIONS

export const ROLE_PROFILES: Record<string, Permission[]> = {
  admin: Object.keys(PERMISSIONS) as Permission[],

  provider: [
    'patients_view', 'patients_edit',
    'test_results_view', 'test_results_create',
    'allergens_view', 'vial_prep_view',
    'dosing_view', 'dosing_administer',
    'encounters_view', 'encounters_create', 'encounters_edit',
    'appointments_view', 'appointments_create', 'appointments_edit',
    'waiting_room_view',
    'insurance_view', 'billing_rules_view', 'cpt_codes_view', 'icd10_view',
    'forms_view', 'consent_view', 'videos_view',
    'audit_log_view', 'settings_view',
    'reports_view',
  ],

  clinical_staff: [
    'patients_view', 'patients_edit',
    'test_results_view', 'test_results_create',
    'allergens_view', 'vial_prep_view', 'vial_prep_manage',
    'dosing_view', 'dosing_administer',
    'encounters_view', 'encounters_create',
    'appointments_view',
    'waiting_room_view', 'waiting_room_manage',
    'insurance_view', 'cpt_codes_view', 'icd10_view',
    'forms_view', 'consent_view', 'videos_view',
    'settings_view',
  ],

  front_desk: [
    'patients_view', 'patients_create', 'patients_edit',
    'appointments_view', 'appointments_create', 'appointments_edit', 'appointments_delete',
    'waiting_room_view', 'waiting_room_manage',
    'insurance_view',
    'forms_view', 'consent_view', 'videos_view',
    'settings_view',
  ],

  billing: [
    'patients_view', 'encounters_view',
    'insurance_view', 'insurance_manage',
    'billing_rules_view', 'billing_rules_manage',
    'cpt_codes_view', 'cpt_codes_manage',
    'icd10_view', 'icd10_manage',
    'audit_log_view', 'settings_view',
    'reports_view',
  ],

  office_manager: [
    'patients_view', 'patients_create', 'patients_edit',
    'test_results_view', 'allergens_view', 'allergens_manage',
    'vial_prep_view', 'dosing_view',
    'encounters_view',
    'appointments_view', 'appointments_create', 'appointments_edit', 'appointments_delete',
    'waiting_room_view', 'waiting_room_manage',
    'insurance_view', 'insurance_manage',
    'billing_rules_view', 'billing_rules_manage',
    'cpt_codes_view', 'cpt_codes_manage',
    'icd10_view', 'icd10_manage',
    'forms_view', 'forms_manage', 'consent_view',
    'videos_view', 'videos_manage',
    'users_view', 'audit_log_view',
    'settings_view', 'settings_manage',
    'doctors_manage', 'nurses_manage',
    'reports_view',
  ],
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  provider: 'Provider (MD/DO)',
  clinical_staff: 'Clinical Staff (RN/MA)',
  front_desk: 'Front Desk',
  billing: 'Billing',
  office_manager: 'Office Manager',
}

export function hasPermission(
  userRole: string,
  userPermissionOverrides: string | null | undefined,
  permission: Permission
): boolean {
  if (userRole === 'admin') return true
  if (userPermissionOverrides) {
    try {
      const overrides = JSON.parse(userPermissionOverrides) as Record<string, boolean>
      if (permission in overrides) return overrides[permission]
    } catch { /* ignore */ }
  }
  const profile = ROLE_PROFILES[userRole] ?? []
  return profile.includes(permission)
}
