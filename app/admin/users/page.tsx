'use client';

import { useEffect, useState, useCallback } from 'react';
import { PERMISSIONS, ROLE_PROFILES, ROLE_LABELS, Permission } from '@/lib/permissions';

interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string | null;
  active: boolean;
  mfaEnabled: boolean;
  defaultLocationId: string | null;
  createdAt: string;
}

const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

const PERMISSION_GROUPS: Record<string, Permission[]> = {
  Patients: ['patients_view', 'patients_create', 'patients_edit', 'patients_delete'],
  Clinical: ['test_results_view', 'test_results_create', 'allergens_view', 'allergens_manage', 'vial_prep_view', 'vial_prep_manage', 'dosing_view', 'dosing_administer'],
  Encounters: ['encounters_view', 'encounters_create', 'encounters_edit'],
  Scheduling: ['appointments_view', 'appointments_create', 'appointments_edit', 'appointments_delete'],
  'Waiting Room': ['waiting_room_view', 'waiting_room_manage'],
  'Billing & Insurance': ['insurance_view', 'insurance_manage', 'billing_rules_view', 'billing_rules_manage', 'cpt_codes_view', 'cpt_codes_manage', 'icd10_view', 'icd10_manage'],
  'Forms & Consent': ['forms_view', 'forms_manage', 'consent_view'],
  Videos: ['videos_view', 'videos_manage'],
  Admin: ['users_view', 'users_manage', 'audit_log_view', 'settings_view', 'settings_manage', 'doctors_manage', 'nurses_manage', 'locations_manage', 'practices_manage'],
};

function parseOverrides(permissions: string | null): Record<string, boolean> {
  if (!permissions) return {};
  try { return JSON.parse(permissions); } catch { return {}; }
}

function getEffectivePermission(role: string, overrides: Record<string, boolean>, perm: Permission): { value: boolean; source: 'override' | 'role' } {
  if (perm in overrides) return { value: overrides[perm], source: 'override' };
  const profile = ROLE_PROFILES[role] ?? [];
  return { value: profile.includes(perm), source: 'role' };
}

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'staff' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create user');
      }
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 420, padding: 28 }}>
        <div className="card-title" style={{ marginBottom: 20 }}>Add New User</div>
        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Name</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={{ width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required style={{ width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Password</label>
            <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required style={{ width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Role</label>
            <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box' }}>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
              <option value="staff">Staff (legacy)</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Creating…' : 'Create User'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PermissionPanel({ user, onSaved }: { user: StaffUser; onSaved: (updated: StaffUser) => void }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() => parseOverrides(user.permissions));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(perm: Permission) {
    setOverrides(prev => {
      const current = getEffectivePermission(user.role, prev, perm);
      const newOverrides = { ...prev };
      // If toggling to the opposite of the role default, set explicit override
      // If setting back to role default, remove override
      const roleDefault = (ROLE_PROFILES[user.role] ?? []).includes(perm);
      const newValue = !current.value;
      if (newValue === roleDefault) {
        delete newOverrides[perm];
      } else {
        newOverrides[perm] = newValue;
      }
      return newOverrides;
    });
    setSaved(false);
  }

  function clearOverrides() {
    setOverrides({});
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: Object.keys(overrides).length > 0 ? overrides : null }),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await res.json() as StaffUser;
      onSaved(updated);
      setSaved(true);
    } catch {
      alert('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          <span style={{ fontWeight: 600, color: '#374151' }}>Permission Overrides</span>
          &nbsp;· Checked = granted. Role defaults shown in lighter color. Overrides shown in teal.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.keys(overrides).length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={clearOverrides}>Clear Overrides</button>
          )}
          <button className="btn btn-sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✅ Saved' : 'Save Permissions'}
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
          <div key={group} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{group}</div>
            {perms.map(perm => {
              const { value, source } = getEffectivePermission(user.role, overrides, perm);
              return (
                <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '3px 0', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={() => toggle(perm)}
                    style={{ accentColor: source === 'override' ? '#0d9488' : '#94a3b8' }}
                  />
                  <span style={{ color: source === 'override' ? '#0d9488' : '#374151', fontWeight: source === 'override' ? 600 : 400 }}>
                    {perm.replace(/_/g, ' ')}
                  </span>
                  {source === 'override' && (
                    <span style={{ fontSize: 10, color: '#0d9488', background: '#f0fdfa', padding: '1px 5px', borderRadius: 4, border: '1px solid #99f6e4' }}>override</span>
                  )}
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadUsers = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/users')
      .then(r => { if (!r.ok) throw new Error('Failed to load users'); return r.json(); })
      .then(d => setUsers(d.users ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  async function toggleActive(user: StaffUser) {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !user.active }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json() as StaffUser;
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    } catch {
      alert('Failed to update user');
    }
  }

  async function changeRole(user: StaffUser, role: string) {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json() as StaffUser;
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    } catch {
      alert('Failed to update role');
    }
  }

  function handlePermSaved(updated: StaffUser) {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
  }

  return (
    <>
      {showAddModal && (
        <AddUserModal onClose={() => setShowAddModal(false)} onCreated={loadUsers} />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">🛡️ User Management</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${filtered.length} staff member${filtered.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <button className="btn" onClick={() => setShowAddModal(true)}>+ Add User</button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

        <div className="card" style={{ marginBottom: 16 }}>
          <input
            className="form-input"
            placeholder="Search by name, email, or role…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No users found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(user => {
              const overrideCount = Object.keys(parseOverrides(user.permissions)).length;
              const isExpanded = expandedId === user.id;
              return (
                <div key={user.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* User Row */}
                  <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {/* Avatar */}
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: user.active ? '#0d9488' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Name + email */}
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{user.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{user.email}</div>
                    </div>

                    {/* Role dropdown */}
                    <select
                      value={user.role}
                      onChange={e => changeRole(user, e.target.value)}
                      style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb', color: '#374151', cursor: 'pointer' }}
                    >
                      {Object.entries(ROLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                      <option value="staff">Staff (legacy)</option>
                    </select>

                    {/* Status badges */}
                    <span className={`badge ${user.active ? 'badge-green' : 'badge-gray'}`}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                    {user.mfaEnabled && <span className="badge badge-teal">MFA</span>}
                    {overrideCount > 0 && (
                      <span className="badge badge-blue">{overrideCount} override{overrideCount !== 1 ? 's' : ''}</span>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => toggleActive(user)}
                      >
                        {user.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setExpandedId(isExpanded ? null : user.id)}
                        style={{ minWidth: 100 }}
                      >
                        {isExpanded ? '▲ Hide Perms' : '▼ Permissions'}
                      </button>
                    </div>
                  </div>

                  {/* Expandable permission panel */}
                  {isExpanded && (
                    <PermissionPanel user={user} onSaved={handlePermSaved} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
