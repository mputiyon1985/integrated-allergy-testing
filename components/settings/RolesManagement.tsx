'use client';

import { useState, useEffect } from 'react';
import { ROLE_PROFILES, ROLE_LABELS, Permission } from '@/lib/permissions';

const PERMISSION_GROUPS: Record<string, Permission[]> = {
  'Patients': ['patients_view', 'patients_create', 'patients_edit', 'patients_delete'],
  'Clinical': ['test_results_view', 'test_results_create', 'allergens_view', 'allergens_manage', 'vial_prep_view', 'vial_prep_manage', 'dosing_view', 'dosing_administer'],
  'Encounters': ['encounters_view', 'encounters_create', 'encounters_edit'],
  'Scheduling': ['appointments_view', 'appointments_create', 'appointments_edit', 'appointments_delete'],
  'Waiting Room': ['waiting_room_view', 'waiting_room_manage'],
  'Billing & Insurance': ['insurance_view', 'insurance_manage', 'billing_rules_view', 'billing_rules_manage', 'cpt_codes_view', 'cpt_codes_manage', 'icd10_view', 'icd10_manage'],
  'Forms & Consent': ['forms_view', 'forms_manage', 'consent_view'],
  'Videos': ['videos_view', 'videos_manage'],
  'Admin': ['users_view', 'users_manage', 'audit_log_view', 'settings_view', 'settings_manage', 'doctors_manage', 'nurses_manage', 'locations_manage', 'practices_manage'],
};

const ROLES = ['admin', 'provider', 'clinical_staff', 'front_desk', 'billing', 'office_manager'];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Full system access — users, settings, all clinical & billing data',
  provider: 'Full clinical access: patients, encounters, testing, dosing + view billing',
  clinical_staff: 'Waiting room, allergy testing, vial prep, dosing, patient care',
  front_desk: 'Scheduling, patient check-in, demographics, appointment management',
  billing: 'Insurance hub, CPT/ICD-10 codes, billing rules, encounter billing view',
  office_manager: 'All operations + settings management, excludes user administration',
};

const ROLE_EMOJIS: Record<string, string> = {
  admin: '🔴',
  provider: '🟣',
  clinical_staff: '🟢',
  front_desk: '🔵',
  billing: '🟡',
  office_manager: '🟠',
};

function formatPermissionKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function RolesManagement() {
  const [view, setView] = useState<'matrix' | 'cards'>('matrix');
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then((users: Array<{ role: string }>) => {
        const counts: Record<string, number> = {};
        for (const u of users) {
          counts[u.role] = (counts[u.role] ?? 0) + 1;
        }
        setUserCounts(counts);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Role Permissions</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            6 built-in roles • permissions are inherited by role, with per-user overrides in the Users tab
          </div>
        </div>
        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <button
            onClick={() => setView('matrix')}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: view === 'matrix' ? '#0d9488' : '#f8fafc',
              color: view === 'matrix' ? '#fff' : '#374151',
            }}
          >
            📊 Matrix
          </button>
          <button
            onClick={() => setView('cards')}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: view === 'cards' ? '#0d9488' : '#f8fafc',
              color: view === 'cards' ? '#fff' : '#374151',
            }}
          >
            🃏 Cards
          </button>
        </div>
      </div>

      {view === 'matrix' ? (
        /* ── Matrix View ── */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e2e8f0', minWidth: 180 }}>
                  Permission
                </th>
                {ROLES.map(role => (
                  <th key={role} style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e2e8f0', minWidth: 90 }}>
                    <div>{ROLE_EMOJIS[role]}</div>
                    <div style={{ fontSize: 10, marginTop: 2, whiteSpace: 'nowrap' }}>
                      {ROLE_LABELS[role]?.replace(' (MD/DO)', '').replace(' (RN/MA)', '')}
                    </div>
                    <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>
                      {userCounts[role] ?? 0} user{(userCounts[role] ?? 0) !== 1 ? 's' : ''}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                <>
                  {/* Group header */}
                  <tr key={`group-${group}`}>
                    <td colSpan={ROLES.length + 1} style={{
                      padding: '8px 14px', background: '#1e293b', color: '#e2e8f0',
                      fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {group}
                    </td>
                  </tr>
                  {/* Permission rows */}
                  {perms.map((perm, i) => {
                    const isEven = i % 2 === 0;
                    return (
                      <tr key={perm} style={{ background: isEven ? '#fff' : '#f8fafc' }}>
                        <td style={{ padding: '7px 14px', color: '#374151', borderBottom: '1px solid #f1f5f9' }}>
                          {formatPermissionKey(perm)}
                        </td>
                        {ROLES.map(role => {
                          const allPerms = ROLE_PROFILES[role] ?? [];
                          const has = role === 'admin' || allPerms.includes(perm);
                          return (
                            <td key={role} style={{
                              textAlign: 'center', padding: '7px 10px', borderBottom: '1px solid #f1f5f9',
                              color: has ? '#0d9488' : '#d1d5db',
                            }}>
                              {has ? '✅' : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Card View ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {ROLES.map(role => {
            const profile = ROLE_PROFILES[role] ?? [];
            const groupAccess = Object.entries(PERMISSION_GROUPS).filter(([, perms]) =>
              role === 'admin' || perms.some(p => profile.includes(p))
            );
            const count = userCounts[role] ?? 0;
            return (
              <div key={role} style={{
                border: '1px solid #e2e8f0', borderRadius: 12, padding: 20,
                background: '#fafafa',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{ROLE_EMOJIS[role]}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                        {ROLE_LABELS[role]}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        {count} user{count !== 1 ? 's' : ''} assigned
                      </div>
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                    background: role === 'admin' ? '#fee2e2' : '#f0fdf4',
                    color: role === 'admin' ? '#dc2626' : '#16a34a',
                  }}>
                    {role === 'admin' ? 'FULL ACCESS' : `${profile.length} perms`}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                  {ROLE_DESCRIPTIONS[role]}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {groupAccess.map(([group]) => (
                    <span key={group} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                      background: '#e0f2fe', color: '#0369a1',
                    }}>
                      {group}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <div style={{ marginTop: 20, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 12, color: '#166534' }}>
        💡 <strong>Role profiles are system-defined.</strong> To grant a user access beyond their role, use the <strong>Users tab</strong> to set individual permission overrides.
      </div>
    </div>
  );
}
