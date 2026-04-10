'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api-fetch';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  active: number;
  createdAt: string;
}

interface EmailLog {
  id: string;
  patientId?: string;
  patientEmail: string;
  subject: string;
  templateName?: string;
  status: string;
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

interface EmailSettings {
  // Resend
  apiKey: string;
  apiKeyConfigured: boolean;
  fromEmail: string;
  fromName: string;
  // Provider
  emailProvider: string;
  // O365
  o365ClientId: string;
  o365ClientSecret: string;
  o365ClientSecretConfigured: boolean;
  o365TenantId: string;
  o365Mailbox: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  appointment_reminder: 'Appointment Reminder',
  test_results: 'Test Results',
  general: 'General',
  billing: 'Billing',
};

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  sent:    { color: '#15803d', bg: '#dcfce7' },
  failed:  { color: '#b91c1c', bg: '#fee2e2' },
  pending: { color: '#b45309', bg: '#fef9c3' },
  bounced: { color: '#6b21a8', bg: '#f3e8ff' },
};

const SAMPLE_VARS = {
  patientName: 'Jane Smith',
  date: 'April 15, 2026',
  time: '2:30 PM',
  location: 'Northern Virginia Allergy Center',
  practiceName: 'Integrated Allergy Testing',
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export default function EmailTab() {
  const [subTab, setSubTab] = useState<'settings' | 'templates' | 'logs'>('settings');

  // Settings state
  const [settings, setSettings] = useState<EmailSettings>({
    apiKey: '', apiKeyConfigured: false, fromEmail: '', fromName: '',
    emailProvider: 'resend',
    o365ClientId: '', o365ClientSecret: '', o365ClientSecretConfigured: false,
    o365TenantId: '', o365Mailbox: '',
  });
  const [settingsForm, setSettingsForm] = useState({
    apiKey: '', fromEmail: '', fromName: '',
    emailProvider: 'resend',
    o365ClientId: '', o365ClientSecret: '', o365TenantId: '', o365Mailbox: '',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [testingSending, setTestingSending] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [showTplModal, setShowTplModal] = useState(false);
  const [editingTpl, setEditingTpl] = useState<EmailTemplate | null>(null);
  const [tplForm, setTplForm] = useState({ name: '', category: 'general', subject: '', body: '' });
  const [tplSaving, setTplSaving] = useState(false);
  const [tplPreview, setTplPreview] = useState(false);
  const [tplMsg, setTplMsg] = useState('');

  // Logs state
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState({ status: '', search: '', from: '', to: '' });
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  const loadSettings = useCallback(async () => {
    const r = await fetch('/api/email/settings');
    if (r.ok) {
      const d = await r.json() as EmailSettings;
      setSettings(d);
      setSettingsForm({
        apiKey: '',
        fromEmail: d.fromEmail,
        fromName: d.fromName,
        emailProvider: d.emailProvider ?? 'resend',
        o365ClientId: d.o365ClientId ?? '',
        o365ClientSecret: '',   // never pre-fill password fields from server
        o365TenantId: d.o365TenantId ?? '',
        o365Mailbox: d.o365Mailbox ?? '',
      });
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    setTplLoading(true);
    await apiFetch('/api/email/seed', { method: 'POST' }).catch(() => {});
    const r = await fetch('/api/email/templates?all=1');
    if (r.ok) {
      const d = await r.json() as { templates: EmailTemplate[] };
      setTemplates(d.templates ?? []);
    }
    setTplLoading(false);
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    const params = new URLSearchParams();
    if (logFilter.status) params.set('status', logFilter.status);
    if (logFilter.search) params.set('search', logFilter.search);
    if (logFilter.from) params.set('from', logFilter.from);
    if (logFilter.to) params.set('to', logFilter.to);
    const r = await fetch(`/api/email/logs?${params}`);
    if (r.ok) {
      const d = await r.json() as { logs: EmailLog[] };
      setLogs(d.logs ?? []);
    }
    setLogsLoading(false);
  }, [logFilter]);

  useEffect(() => {
    if (subTab === 'settings') loadSettings();
    if (subTab === 'templates') loadTemplates();
    if (subTab === 'logs') loadLogs();
  }, [subTab, loadSettings, loadTemplates, loadLogs]);

  async function saveSettings() {
    setSettingsSaving(true);
    setSettingsMsg('');
    const payload: Record<string, string> = {
      fromEmail: settingsForm.fromEmail,
      fromName: settingsForm.fromName,
      emailProvider: settingsForm.emailProvider,
      o365ClientId: settingsForm.o365ClientId,
      o365TenantId: settingsForm.o365TenantId,
      o365Mailbox: settingsForm.o365Mailbox,
    };
    if (settingsForm.apiKey) payload.apiKey = settingsForm.apiKey;
    if (settingsForm.o365ClientSecret) payload.o365ClientSecret = settingsForm.o365ClientSecret;

    const r = await apiFetch('/api/email/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      setSettingsMsg('✅ Settings saved!');
      setSettingsForm(f => ({ ...f, apiKey: '', o365ClientSecret: '' }));
      await loadSettings();
    } else {
      setSettingsMsg('❌ Failed to save settings');
    }
    setSettingsSaving(false);
  }

  async function sendTestEmail() {
    setTestingSending(true);
    setSettingsMsg('');
    const testTo = settings.fromEmail || settings.o365Mailbox || 'test@example.com';
    const r = await apiFetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: testTo,
        subject: 'Test Email from IAT System',
        body: '<p>This is a test email from <strong>Integrated Allergy Testing</strong> email system. If you received this, your email provider is configured correctly!</p>',
      }),
    });
    const d = await r.json() as { messageId?: string; error?: string };
    if (r.ok) {
      setSettingsMsg(`✅ Test email sent! Message ID: ${d.messageId}`);
    } else {
      setSettingsMsg(`❌ ${d.error || 'Failed to send test email'}`);
    }
    setTestingSending(false);
  }

  function openNewTemplate() {
    setEditingTpl(null);
    setTplForm({ name: '', category: 'general', subject: '', body: '' });
    setTplPreview(false);
    setTplMsg('');
    setShowTplModal(true);
  }

  function openEditTemplate(t: EmailTemplate) {
    setEditingTpl(t);
    setTplForm({ name: t.name, category: t.category ?? 'general', subject: t.subject, body: t.body });
    setTplPreview(false);
    setTplMsg('');
    setShowTplModal(true);
  }

  async function saveTpl() {
    setTplSaving(true);
    setTplMsg('');
    const payload = { name: tplForm.name, category: tplForm.category, subject: tplForm.subject, body: tplForm.body };
    let r: Response;
    if (editingTpl) {
      r = await apiFetch(`/api/email/templates/${editingTpl.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
    } else {
      r = await apiFetch('/api/email/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
    }
    if (r.ok) {
      setShowTplModal(false);
      loadTemplates();
    } else {
      setTplMsg('❌ Failed to save template');
    }
    setTplSaving(false);
  }

  async function deleteTpl(id: string) {
    if (!confirm('Delete this template?')) return;
    await apiFetch(`/api/email/templates/${id}`, { method: 'DELETE' });
    loadTemplates();
  }

  async function toggleTplActive(t: EmailTemplate) {
    await apiFetch(`/api/email/templates/${t.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: t.active === 1 ? 0 : 1 }),
    });
    loadTemplates();
  }

  const isO365Ready = settings.emailProvider === 'o365' && (settings.o365ClientSecretConfigured || settingsForm.o365ClientSecret.length > 0);
  const isResendReady = settings.emailProvider !== 'o365' && settings.apiKeyConfigured;
  const canTest = isO365Ready || isResendReady;

  const SUB_TAB = (t: typeof subTab, label: string) => (
    <button
      onClick={() => setSubTab(t)}
      style={{
        padding: '7px 16px', border: '1px solid #e2e8f0', borderRadius: 6,
        background: subTab === t ? '#0d9488' : '#f8fafc',
        color: subTab === t ? '#fff' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer',
      }}
    >{label}</button>
  );

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>📧 Email</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {SUB_TAB('settings', '⚙️ Provider')}
          {SUB_TAB('templates', '📝 Templates')}
          {SUB_TAB('logs', '📋 Email Log')}
        </div>
      </div>

      {/* ── Provider Settings ── */}
      {subTab === 'settings' && (
        <div style={{ maxWidth: 540 }}>
          {/* Provider selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, textTransform: 'uppercase' }}>
              Email Provider
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['resend', 'o365'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setSettingsForm(f => ({ ...f, emailProvider: p }))}
                  style={{
                    padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    border: `2px solid ${settingsForm.emailProvider === p ? '#0d9488' : '#e2e8f0'}`,
                    background: settingsForm.emailProvider === p ? '#f0fdfa' : '#f8fafc',
                    color: settingsForm.emailProvider === p ? '#0d9488' : '#64748b',
                  }}
                >
                  {p === 'resend' ? '📨 Resend' : '🏢 Microsoft 365 / Exchange'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Resend fields ── */}
          {settingsForm.emailProvider === 'resend' && (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>Resend Configuration</div>

              {!settings.apiKeyConfigured && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                  ⚠️ No Resend API key configured. Get your free key at{' '}
                  <a href="https://resend.com" target="_blank" rel="noreferrer" style={{ color: '#0d9488' }}>resend.com</a>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>
                  Resend API Key {settings.apiKeyConfigured ? '(configured ✅)' : '(not set)'}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={settings.apiKeyConfigured ? 'Enter new key to replace...' : 're_...'}
                  value={settingsForm.apiKey}
                  onChange={e => setSettingsForm(f => ({ ...f, apiKey: e.target.value }))}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Leave blank to keep existing key</div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>From Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="noreply@clinic.com"
                  value={settingsForm.fromEmail}
                  onChange={e => setSettingsForm(f => ({ ...f, fromEmail: e.target.value }))}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>From Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Integrated Allergy Testing"
                  value={settingsForm.fromName}
                  onChange={e => setSettingsForm(f => ({ ...f, fromName: e.target.value }))}
                />
              </div>
            </>
          )}

          {/* ── O365 fields ── */}
          {settingsForm.emailProvider === 'o365' && (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>Microsoft 365 / Exchange Configuration</div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#1d4ed8' }}>
                ℹ️ Uses Microsoft Graph API with app-only (client credentials) authentication. Ensure the Azure AD app has <strong>Mail.Send</strong> application permission.
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Azure Client ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={settingsForm.o365ClientId}
                  onChange={e => setSettingsForm(f => ({ ...f, o365ClientId: e.target.value }))}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>
                  Azure Client Secret {settings.o365ClientSecretConfigured ? '(configured ✅)' : '(not set — will try Key Vault)'}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={settings.o365ClientSecretConfigured ? 'Enter new secret to replace...' : 'Paste client secret (or leave blank to use Key Vault)'}
                  value={settingsForm.o365ClientSecret}
                  onChange={e => setSettingsForm(f => ({ ...f, o365ClientSecret: e.target.value }))}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  If left blank, the system will try to fetch from Azure Key Vault (<code>hivevault-swarm</code> → <code>mark-azure-ad-client-secret</code>)
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Azure Tenant ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={settingsForm.o365TenantId}
                  onChange={e => setSettingsForm(f => ({ ...f, o365TenantId: e.target.value }))}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Send-From Mailbox</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="allergy@tipinc.ai"
                  value={settingsForm.o365Mailbox}
                  onChange={e => setSettingsForm(f => ({ ...f, o365Mailbox: e.target.value }))}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>The Exchange mailbox used to send emails (must be licensed)</div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={saveSettings}
              disabled={settingsSaving}
              style={{ padding: '8px 20px', borderRadius: 8, background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
            >{settingsSaving ? 'Saving…' : '💾 Save Settings'}</button>

            <button
              onClick={sendTestEmail}
              disabled={testingSending || !canTest}
              style={{ padding: '8px 20px', borderRadius: 8, background: canTest ? '#7c3aed' : '#94a3b8', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: canTest ? 'pointer' : 'not-allowed' }}
            >{testingSending ? 'Sending…' : '🧪 Send Test Email'}</button>
          </div>

          {settingsMsg && (
            <div style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, background: settingsMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', fontSize: 13, color: settingsMsg.startsWith('✅') ? '#15803d' : '#b91c1c', border: `1px solid ${settingsMsg.startsWith('✅') ? '#86efac' : '#fca5a5'}` }}>
              {settingsMsg}
            </div>
          )}
        </div>
      )}

      {/* ── Templates ── */}
      {subTab === 'templates' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Email Templates</div>
            <button onClick={openNewTemplate} style={{ padding: '7px 16px', borderRadius: 8, background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
              + New Template
            </button>
          </div>

          {tplLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading…</div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No templates found</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>Name</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>Category</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>Subject</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>Active</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.name}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{CATEGORY_LABELS[t.category] ?? t.category}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{t.subject}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button
                        onClick={() => toggleTplActive(t)}
                        style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                          background: t.active === 1 ? '#dcfce7' : '#f1f5f9',
                          color: t.active === 1 ? '#15803d' : '#94a3b8' }}
                      >{t.active === 1 ? 'Active' : 'Inactive'}</button>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button onClick={() => openEditTemplate(t)} style={{ marginRight: 6, padding: '4px 10px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✏️ Edit</button>
                      <button onClick={() => deleteTpl(t.id)} style={{ padding: '4px 10px', borderRadius: 6, background: '#fef2f2', color: '#b91c1c', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🗑️ Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Template Modal */}
          {showTplModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{editingTpl ? 'Edit Template' : 'New Template'}</div>
                  <button onClick={() => setShowTplModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>TEMPLATE NAME</label>
                    <input className="form-input" value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Appointment Reminder" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>CATEGORY</label>
                    <select className="form-input" value={tplForm.category} onChange={e => setTplForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="general">General</option>
                      <option value="appointment_reminder">Appointment Reminder</option>
                      <option value="test_results">Test Results</option>
                      <option value="billing">Billing</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>SUBJECT LINE</label>
                  <input className="form-input" value={tplForm.subject} onChange={e => setTplForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Reminder: Your appointment on {{date}}" />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>BODY (HTML supported)</label>
                  <textarea
                    className="form-input"
                    rows={8}
                    value={tplForm.body}
                    onChange={e => setTplForm(f => ({ ...f, body: e.target.value }))}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                    placeholder="<p>Hi {{patientName}}, ...</p>"
                  />
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    Variables: <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>{'{{patientName}}'}</code>{' '}
                    <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>{'{{date}}'}</code>{' '}
                    <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>{'{{time}}'}</code>{' '}
                    <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>{'{{location}}'}</code>{' '}
                    <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>{'{{practiceName}}'}</code>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <button
                    onClick={() => setTplPreview(v => !v)}
                    style={{ padding: '5px 14px', borderRadius: 6, background: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >{tplPreview ? '📝 Edit' : '👁️ Preview'}</button>
                </div>

                {tplPreview && (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16, background: '#fafafa' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                      Subject: {interpolate(tplForm.subject, SAMPLE_VARS)}
                    </div>
                    <div
                      style={{ fontSize: 13 }}
                      dangerouslySetInnerHTML={{ __html: interpolate(tplForm.body, SAMPLE_VARS) }}
                    />
                  </div>
                )}

                {tplMsg && <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>{tplMsg}</div>}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowTplModal(false)} style={{ padding: '8px 20px', borderRadius: 8, background: '#f1f5f9', color: '#374151', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveTpl} disabled={tplSaving} style={{ padding: '8px 20px', borderRadius: 8, background: '#0d9488', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {tplSaving ? 'Saving…' : '💾 Save Template'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Email Log ── */}
      {subTab === 'logs' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="form-input" style={{ width: 200 }} placeholder="Search email/subject..." value={logFilter.search} onChange={e => setLogFilter(f => ({ ...f, search: e.target.value }))} />
            <select className="form-input" style={{ width: 140 }} value={logFilter.status} onChange={e => setLogFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">All Status</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="bounced">Bounced</option>
            </select>
            <input type="date" className="form-input" style={{ width: 150 }} value={logFilter.from} onChange={e => setLogFilter(f => ({ ...f, from: e.target.value }))} />
            <span style={{ color: '#94a3b8', fontSize: 12 }}>to</span>
            <input type="date" className="form-input" style={{ width: 150 }} value={logFilter.to} onChange={e => setLogFilter(f => ({ ...f, to: e.target.value }))} />
            <button onClick={loadLogs} style={{ padding: '6px 14px', borderRadius: 6, background: '#0d9488', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>🔍 Filter</button>
          </div>

          {logsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading…</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No emails logged yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>To</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>Subject</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>Template</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const sc = STATUS_COLORS[log.status] ?? { color: '#374151', bg: '#f1f5f9' };
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</td>
                      <td style={{ padding: '10px 12px' }}>{log.patientEmail}</td>
                      <td style={{ padding: '10px 12px' }}>{log.subject}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{log.templateName ?? '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>{log.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {selectedLog && (
            <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#1e293b' }}>Log Detail: {selectedLog.subject}</div>
              {selectedLog.errorMessage && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#b91c1c', marginBottom: 8 }}>
                  Error: {selectedLog.errorMessage}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#64748b' }}>Patient ID: {selectedLog.patientId ?? '—'} | Sent At: {selectedLog.sentAt ?? '—'}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
