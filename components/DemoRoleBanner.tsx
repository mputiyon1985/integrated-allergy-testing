'use client';

import { useEffect, useState } from 'react';

interface SessionInfo {
  role: string;
  name: string;
  email: string;
}

const DEMO_EMAILS = [
  'demo.provider@iat-demo.com',
  'demo.nurse@iat-demo.com',
  'demo.frontdesk@iat-demo.com',
  'demo.billing@iat-demo.com',
  'demo.manager@iat-demo.com',
];

const ROLE_LABELS: Record<string, string> = {
  provider: '👨‍⚕️ Provider',
  clinical_staff: '💉 Clinical Staff',
  front_desk: '🗓 Front Desk',
  billing: '💳 Billing',
  office_manager: '🏢 Office Manager',
  admin: '🔑 Admin',
};

export default function DemoRoleBanner() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.email && DEMO_EMAILS.includes(d.email)) setSession(d); })
      .catch(() => {});
  }, []);

  if (!session) return null;

  async function returnToAdmin() {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnToAdmin: true }),
      });
      if (res.ok) window.location.href = '/';
      else setLoading(false);
    } catch { setLoading(false); }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 500,
      background: '#1e1b4b', color: '#fff',
      borderRadius: 12, padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      fontSize: 13, fontWeight: 500,
      pointerEvents: 'auto',
    }}>
      <span>🎭 Viewing as <strong>{ROLE_LABELS[session.role] ?? session.role}</strong></span>
      <button
        onClick={returnToAdmin}
        disabled={loading}
        style={{
          background: '#4f46e5', color: '#fff', border: 'none',
          borderRadius: 7, padding: '6px 12px', fontSize: 12,
          fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? '...' : '↩ Back to Admin'}
      </button>
    </div>
  );
}
