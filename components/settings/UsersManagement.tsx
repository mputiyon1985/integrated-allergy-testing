'use client';

import { useState, useEffect, useCallback } from 'react';
import { ROLE_LABELS } from '@/lib/permissions';

const ROLE_OPTIONS = [
  { value: 'admin',          label: '🔴 Admin' },
  { value: 'provider',       label: '🟣 Provider (MD/DO)' },
  { value: 'clinical_staff', label: '🟢 Clinical Staff (RN/MA)' },
  { value: 'front_desk',     label: '🔵 Front Desk' },
  { value: 'billing',        label: '🟡 Billing' },
  { value: 'office_manager', label: '🟠 Office Manager' },
];

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  mfaEnabled: boolean;
  defaultLocationId: string | null;
  defaultLocationName: string | null;
  createdAt: string;
};

type Location = {
  id: string;
  name: string;
  key: string;
  active: boolean;
};

type CurrentUser = {
  id: string;
  role: string;
  email: string;
  name: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:          { bg: '#fee2e2', color: '#dc2626' },
  provider:       { bg: '#ede9fe', color: '#7c3aed' },
  clinical_staff: { bg: '#dcfce7', color: '#16a34a' },
  front_desk:     { bg: '#dbeafe', color: '#2563eb' },
  billing:        { bg: '#fef9c3', color: '#ca8a04' },
  office_manager: { bg: '#ffedd5', color: '#ea580c' },
};

function RoleBadge({ role }: { role: string }) {
  const colors = ROLE_COLORS[role] ?? { bg: '#f1f5f9', color: '#64748b' };
  const label = ROLE_LABELS[role] ?? role;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: colors.bg,
      color: colors.color,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        width: '100%', maxWidth: 500, padding: 28, position: 'relative',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{title}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          className="form-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '••••••••'}
          style={{ paddingRight: 40 }}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: 14,
          }}
          tabIndex={-1}
        >
          {show ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );
}

function ErrorBanner({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13 }}>
      ⚠️ {msg}
      {onRetry && <button onClick={onRetry} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>Retry</button>}
    </div>
  );
}

// ─── Add User Modal ─────────────────────────────────────────────────────────

function AddUserModal({ locations, onClose, onSuccess }: {
  locations: Location[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'front_desk', defaultLocationId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Name, email, and password are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          defaultLocationId: form.defaultLocationId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="👥 Add New User" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <ErrorBanner msg={error} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Email *</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
          </div>
          <PasswordField label="Password *" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} />
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Role</label>
            <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Default Location</label>
            <select className="form-input" value={form.defaultLocationId} onChange={e => setForm(f => ({ ...f, defaultLocationId: e.target.value }))}>
              <option value="">— None —</option>
              {locations.filter(l => l.active).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? '⏳ Creating…' : '✅ Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit User Modal ─────────────────────────────────────────────────────────

function EditUserModal({ user, locations, currentUserId, onClose, onSuccess }: {
  user: StaffUser;
  locations: Location[];
  currentUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isSelf = user.id === currentUserId;
  const [form, setForm] = useState({
    name: user.name,
    role: user.role,
    defaultLocationId: user.defaultLocationId ?? '',
    active: user.active,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role,
          defaultLocationId: form.defaultLocationId || null,
          active: form.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`✏️ Edit — ${user.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <ErrorBanner msg={error} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Name</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Role</label>
            <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} disabled={isSelf}>
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {isSelf && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Cannot change your own role.</p>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Default Location</label>
            <select className="form-input" value={form.defaultLocationId} onChange={e => setForm(f => ({ ...f, defaultLocationId: e.target.value }))}>
              <option value="">— None —</option>
              {locations.filter(l => l.active).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 8, cursor: isSelf ? 'not-allowed' : 'pointer' }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                disabled={isSelf}
              />
              Active account
            </label>
            {isSelf && <span style={{ fontSize: 12, color: '#94a3b8' }}>Cannot deactivate yourself.</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? '⏳ Saving…' : '💾 Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Reset Password Modal ────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose, onSuccess }: {
  user: StaffUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`🔑 Reset Password — ${user.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <ErrorBanner msg={error} />}
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Set a new password for <strong>{user.email}</strong>. They will need to use this new password on next login.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <PasswordField label="New Password *" value={password} onChange={setPassword} placeholder="Min. 8 characters" />
          <PasswordField label="Confirm Password *" value={confirm} onChange={setConfirm} placeholder="Re-enter password" />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !password || !confirm} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (saving || !password || !confirm) ? 0.7 : 1 }}>
            {saving ? '⏳ Resetting…' : '🔑 Reset Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Deactivate Confirm ──────────────────────────────────────────────────────

function DeactivateConfirmModal({ user, onClose, onConfirm, busy }: {
  user: StaffUser; onClose: () => void; onConfirm: () => void; busy: boolean;
}) {
  const action = user.active ? 'Deactivate' : 'Reactivate';
  return (
    <Modal title={`${user.active ? '⬜ Deactivate' : '✅ Reactivate'} User`} onClose={onClose}>
      <p style={{ fontSize: 14, color: '#374151', marginBottom: 24 }}>
        {user.active
          ? <>Are you sure you want to <strong>deactivate</strong> <strong>{user.name}</strong>? They will be unable to log in until reactivated.</>
          : <>Are you sure you want to <strong>reactivate</strong> <strong>{user.name}</strong>? They will be able to log in again.</>
        }
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
          Cancel
        </button>
        <button onClick={onConfirm} disabled={busy} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: user.active ? '#dc2626' : '#16a34a', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? '⏳ …' : action}
        </button>
      </div>
    </Modal>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function UsersManagement({ currentUser }: { currentUser: CurrentUser }) {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<StaffUser | null>(null);
  const [resetUser, setResetUser] = useState<StaffUser | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<StaffUser | null>(null);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadStaff = useCallback(() => {
    setError(null);
    fetch('/api/staff')
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Session expired' : `HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        setStaff(d.staff ?? (Array.isArray(d) ? d : []));
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load users');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadStaff();
    (() => {
      let lp = '';
      try {
        const p = localStorage.getItem('iat_active_practice') ?? '';
        if (p) lp = `?practiceId=${p}`;
      } catch {}
      return fetch(`/api/locations${lp}`);
    })()
      .then(r => r.ok ? r.json() : [])
      .then(d => setLocations(Array.isArray(d) ? d : (d.locations ?? [])))
      .catch(() => {});
  }, [loadStaff]);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  async function handleDeactivate() {
    if (!deactivateUser) return;
    setDeactivateBusy(true);
    try {
      const res = await fetch(`/api/staff/${deactivateUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !deactivateUser.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setDeactivateUser(null);
      showSuccess(`${deactivateUser.active ? 'Deactivated' : 'Reactivated'} ${deactivateUser.name}`);
      loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    } finally {
      setDeactivateBusy(false);
    }
  }

  if (currentUser.role !== 'admin') {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
        🔒 User Management is only accessible to admins.
      </div>
    );
  }

  return (
    <>
      {/* Modals */}
      {showAdd && (
        <AddUserModal
          locations={locations}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); showSuccess('User created successfully'); loadStaff(); }}
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          locations={locations}
          currentUserId={currentUser.id}
          onClose={() => setEditUser(null)}
          onSuccess={() => { setEditUser(null); showSuccess(`Updated ${editUser.name}`); loadStaff(); }}
        />
      )}
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSuccess={() => { setResetUser(null); showSuccess(`Password reset for ${resetUser.name}`); }}
        />
      )}
      {deactivateUser && (
        <DeactivateConfirmModal
          user={deactivateUser}
          onClose={() => setDeactivateUser(null)}
          onConfirm={handleDeactivate}
          busy={deactivateBusy}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="card-title" style={{ marginBottom: 2 }}>👥 User Management</div>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Manage staff accounts — roles, access, and credentials.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          + Add User
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 16px', marginBottom: 12, color: '#15803d', fontSize: 13, fontWeight: 600 }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Error banner */}
      {error && <ErrorBanner msg={error} onRetry={loadStaff} />}

      {/* Table */}
      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>Loading users…</div>
      ) : staff.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No staff users found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Name', 'Email', 'Role', 'Status', 'MFA', 'Default Location', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((u, i) => {
                const isSelf = u.id === currentUser.id;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    {/* Name */}
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                      {u.name}
                      {isSelf && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: 999, textTransform: 'uppercase' }}>
                          You
                        </span>
                      )}
                    </td>
                    {/* Email */}
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{u.email}</td>
                    {/* Role */}
                    <td style={{ padding: '10px 12px' }}><RoleBadge role={u.role} /></td>
                    {/* Status */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: u.active ? '#dcfce7' : '#f1f5f9',
                        color: u.active ? '#15803d' : '#94a3b8',
                      }}>
                        {u.active ? '✅ Active' : '⬜ Inactive'}
                      </span>
                    </td>
                    {/* MFA */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: u.mfaEnabled ? '#fef3c7' : '#f1f5f9',
                        color: u.mfaEnabled ? '#b45309' : '#94a3b8',
                      }}>
                        {u.mfaEnabled ? '🔐 MFA On' : '— Off'}
                      </span>
                    </td>
                    {/* Default Location */}
                    <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>
                      {u.defaultLocationName ?? <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          onClick={() => setEditUser(u)}
                          title="Edit"
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer' }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => setDeactivateUser(u)}
                          disabled={isSelf}
                          title={isSelf ? 'Cannot deactivate yourself' : u.active ? 'Deactivate' : 'Reactivate'}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: isSelf ? 'not-allowed' : 'pointer',
                            border: u.active ? '1px solid #fecaca' : '1px solid #bbf7d0',
                            background: u.active ? '#fff7f7' : '#f0fdf4',
                            color: u.active ? '#dc2626' : '#16a34a',
                            opacity: isSelf ? 0.4 : 1,
                          }}
                        >
                          {u.active ? '⬜ Deactivate' : '✅ Reactivate'}
                        </button>
                        <button
                          onClick={() => setResetUser(u)}
                          title="Reset Password"
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fde68a', background: '#fefce8', fontSize: 12, cursor: 'pointer', color: '#92400e' }}
                        >
                          🔑 Reset PW
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
            {staff.length} user{staff.length !== 1 ? 's' : ''} · {staff.filter(u => u.active).length} active
          </p>
        </div>
      )}
    </>
  );
}
