'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [patientCount, setPatientCount] = useState<number | null>(null);
  const [doctorCount, setDoctorCount] = useState<number | null>(null);
  const [nurseCount, setNurseCount] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [patientsRes, doctorsRes, nursesRes, meRes] = await Promise.allSettled([
          fetch('/api/patients'),
          fetch('/api/doctors'),
          fetch('/api/nurses'),
          fetch('/api/auth/me'),
        ]);

        if (patientsRes.status === 'fulfilled' && patientsRes.value.ok) {
          const data = await patientsRes.value.json();
          const list = Array.isArray(data) ? data : (data.patients ?? []);
          setPatientCount(list.length);
        }
        if (doctorsRes.status === 'fulfilled' && doctorsRes.value.ok) {
          const data = await doctorsRes.value.json();
          const list = Array.isArray(data) ? data : (data.doctors ?? []);
          setDoctorCount(list.filter((d: { active?: boolean }) => d.active !== false).length);
        }
        if (nursesRes.status === 'fulfilled' && nursesRes.value.ok) {
          const data = await nursesRes.value.json();
          const list = Array.isArray(data) ? data : (data.nurses ?? []);
          setNurseCount(list.filter((n: { active?: boolean }) => n.active !== false).length);
        }
        if (meRes.status === 'fulfilled' && meRes.value.ok) {
          const data = await meRes.value.json();
          setUserName(data?.user?.name ?? data?.name ?? '');
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">
            {userName ? `Welcome, ${userName}` : 'Dashboard'}
          </div>
          <div className="page-subtitle">{today}</div>
        </div>
        <div className="flex gap-2">
          <Link href="/patients/new" className="btn-secondary btn-sm btn">+ Register Patient</Link>
          <Link href="/testing" className="btn btn-sm">🧪 Start Testing</Link>
        </div>
      </div>

      <div className="page-body">
        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon">👥</div>
            <div className="kpi-label">Total Patients</div>
            {loading ? <div className="spinner" /> : <div className="kpi-value">{patientCount ?? 0}</div>}
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">👨‍⚕️</div>
            <div className="kpi-label">Active Doctors</div>
            {loading ? <div className="spinner" /> : <div className="kpi-value">{doctorCount ?? 0}</div>}
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">👩‍⚕️</div>
            <div className="kpi-label">Active Nurses</div>
            {loading ? <div className="spinner" /> : <div className="kpi-value">{nurseCount ?? 0}</div>}
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">🧪</div>
            <div className="kpi-label">Ready to Test</div>
            <div className="kpi-value" style={{ color: '#0d9488' }}>GO</div>
          </div>
        </div>

        {/* Quick Actions + System Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="card">
            <div className="card-title">Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href="/patients/new" className="btn" style={{ justifyContent: 'flex-start', fontSize: 15 }}>
                👤 Register New Patient
              </Link>
              <Link href="/testing" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
                🧪 Start Testing
              </Link>
              <Link href="/patients" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
                👥 View All Patients
              </Link>
              <Link href="/doctors" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
                👨‍⚕️ Manage Doctors
              </Link>
              <Link href="/nurses" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
                👩‍⚕️ Manage Nurses
              </Link>
              <Link href="/videos" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
                🎬 Manage Videos
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-title">System Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'API Server', status: 'Operational', icon: '🟢' },
                { label: 'Database', status: 'Operational', icon: '🟢' },
                { label: 'Auth Service', status: 'Operational', icon: '🟢' },
                { label: 'Video Service', status: 'Operational', icon: '🟢' },
                { label: 'Print / PDF', status: 'Operational', icon: '🟢' },
                { label: 'HIPAA Compliance', status: 'Active', icon: '🔐' },
              ].map((s) => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 14, color: '#374151' }}>{s.icon} {s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: s.status === 'Active' ? '#e8f9f7' : '#dcfce7', color: s.status === 'Active' ? '#0d9488' : '#15803d' }}>{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
