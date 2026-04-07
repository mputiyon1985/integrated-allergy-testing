'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  userId?: string;
}

export default function DashboardPage() {
  const [patientCount, setPatientCount] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [patientsRes, auditRes] = await Promise.allSettled([
          fetch('/api/patients'),
          fetch('/api/audit'),
        ]);

        if (patientsRes.status === 'fulfilled' && patientsRes.value.ok) {
          const data = await patientsRes.value.json();
          const patients: Patient[] = Array.isArray(data) ? data : (data.patients ?? []);
          setPatientCount(patients.length);
        } else {
          setPatientCount(0);
        }

        if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
          const data = await auditRes.value.json();
          const logs: AuditEntry[] = Array.isArray(data) ? data : (data.logs ?? []);
          setAuditLogs(logs.slice(0, 10));
        }
      } catch {
        setPatientCount(0);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function formatTime(ts: string) {
    try {
      return new Date(ts).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
    } catch {
      return ts;
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Welcome to Integrated Allergy Testing</div>
        </div>
        <div className="flex gap-2">
          <Link href="/patients/new" className="btn-secondary btn-sm btn">
            + Register Patient
          </Link>
          <Link href="/testing" className="btn btn-sm">
            🧪 Start Testing
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon">👥</div>
            <div className="kpi-label">Total Patients</div>
            {loading ? (
              <div className="spinner" />
            ) : (
              <div className="kpi-value">{patientCount ?? 0}</div>
            )}
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">🧪</div>
            <div className="kpi-label">Tests Today</div>
            <div className="kpi-value">—</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">🎬</div>
            <div className="kpi-label">Videos Watched</div>
            <div className="kpi-value">—</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">📝</div>
            <div className="kpi-label">Forms Signed</div>
            <div className="kpi-value">—</div>
          </div>
        </div>

        {/* Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
          {/* Recent Activity */}
          <div className="card">
            <div className="card-title">Recent Activity</div>
            {loading ? (
              <div className="loading-center"><div className="spinner" /><span>Loading...</span></div>
            ) : auditLogs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">No activity yet</div>
                <div>Activity will appear here as patients are registered and tested.</div>
              </div>
            ) : (
              <div>
                {auditLogs.map((log, i) => (
                  <div className="activity-item" key={log.id ?? i}>
                    <div className="activity-dot" />
                    <div className="activity-text">
                      <strong>{log.action}</strong>
                      {log.entityType && (
                        <span className="text-muted"> — {log.entityType}{log.entityId ? ` #${log.entityId}` : ''}</span>
                      )}
                    </div>
                    <div className="activity-time">{formatTime(log.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div>
            <div className="card">
              <div className="card-title">Quick Actions</div>
              <div className="flex flex-col gap-3">
                <Link href="/patients/new" className="btn w-full" style={{ justifyContent: 'flex-start' }}>
                  👤 Register New Patient
                </Link>
                <Link href="/testing" className="btn-secondary w-full" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start' }}>
                  🧪 Start Testing
                </Link>
                <Link href="/patients" className="btn-secondary w-full" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start' }}>
                  👥 View All Patients
                </Link>
                <Link href="/videos" className="btn-secondary w-full" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start' }}>
                  🎬 Manage Videos
                </Link>
              </div>
            </div>

            {/* System Status */}
            <div className="card mt-4">
              <div className="card-title">System Status</div>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'API Server', status: 'Operational' },
                  { label: 'Database', status: 'Operational' },
                  { label: 'Video Service', status: 'Operational' },
                ].map((s) => (
                  <div key={s.label} className="flex justify-between items-center">
                    <span className="text-sm">{s.label}</span>
                    <span className="badge badge-teal">{s.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
