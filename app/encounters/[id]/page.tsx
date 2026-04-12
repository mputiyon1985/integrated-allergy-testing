'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Encounter, DoctorOption, NurseOption, Icd10Option } from '@/components/encounter/types';
import { ENC_STATUS_STYLES } from '@/components/encounter/constants';
import { ActivityRow } from '@/components/encounter/ActivityRow';
import { AddActivityModal } from '@/components/encounter/AddActivityModal';
import { DetailsTab } from '@/components/encounter/DetailsTab';
import { ClaimTab } from '@/components/encounter/ClaimTab';

export default function EncounterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'details' | 'activities' | 'claim'>('details');

  // Claim state
  const [claim, setClaim] = useState<Record<string, unknown> | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState('');

  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [icd10Options, setIcd10Options] = useState<Icd10Option[]>([]);

  const loadEncounter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/encounters/${id}`);
      if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : `HTTP ${r.status}`);
      const data = await r.json();
      setEncounter(data);
      if (data?.locationId) loadDropdowns(data.locationId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg === 'session_expired' ? 'Session expired — please log in again' : `Failed to load encounter: ${msg}`);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { loadEncounter(); }, [loadEncounter]);

  const loadDropdowns = useCallback((overrideLocId?: string) => {
    let locId = overrideLocId ?? '';
    if (!locId) try { locId = localStorage.getItem('iat_active_location') ?? ''; } catch {}
    let practiceId = '';
    if (!locId) try { practiceId = localStorage.getItem('iat_active_practice_filter') ?? ''; } catch {}
    const locParam = locId ? `&locationId=${locId}` : practiceId ? `&practiceId=${practiceId}` : '';

    fetch(`/api/doctors?all=1${locParam}`)
      .then(r => r.ok ? r.json() : { doctors: [] })
      .then(d => {
        const all: (DoctorOption & { active?: boolean; locationId?: string | null })[] =
          Array.isArray(d) ? d : (d.doctors ?? []);
        const filtered = locId ? all.filter(x => !x.locationId || x.locationId === locId) : all;
        setDoctors(filtered.filter(x => x.active !== false));
      }).catch(() => {});

    fetch(`/api/nurses?all=1${locParam}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const all: (NurseOption & { active?: boolean; locationId?: string | null })[] =
          Array.isArray(d) ? d : (d.nurses ?? []);
        const filtered = locId ? all.filter(x => !x.locationId || x.locationId === locId) : all;
        setNurses(filtered.filter(x => x.active !== false));
      }).catch(() => {});

    fetch('/api/icd10-codes?all=true')
      .then(r => r.ok ? r.json() : { codes: [] })
      .then(d => setIcd10Options(d.codes ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadDropdowns();
    const onLocChange = (e: Event) => {
      const detail = (e as CustomEvent<{ locationId?: string }>).detail ?? {};
      loadDropdowns(detail.locationId ?? '');
    };
    window.addEventListener('locationchange', onLocChange);
    return () => window.removeEventListener('locationchange', onLocChange);
  }, [loadDropdowns]);

  async function patchEncounter(fields: Partial<Encounter>) {
    if (!encounter) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/encounters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (r.ok) {
        const data = await r.json();
        setEncounter(prev => prev ? { ...prev, ...data.encounter, activities: prev.activities } : prev);
      }
    } catch {}
    setSaving(false);
  }

  async function loadClaim() {
    setClaimLoading(true);
    setClaimError('');
    try {
      const r = await fetch(`/api/encounters/${id}/claim`, { method: 'POST' });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'Failed'); }
      const data = await r.json();
      setClaim(data);
      if (encounter?.status === 'signed') {
        setEncounter(prev => prev ? { ...prev, status: 'billed' } : prev);
      }
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : 'Failed to generate claim');
    }
    setClaimLoading(false);
  }

  function handleTabClick(tab: 'details' | 'activities' | 'claim') {
    setActiveTab(tab);
    if (tab === 'claim' && !claim && !claimLoading) loadClaim();
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error || !encounter) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 20, color: '#b91c1c', fontSize: 14 }}>
          🚨 {error ?? 'Encounter not found'}
        </div>
        <button onClick={() => router.back()} style={{ marginTop: 16, padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          ← Back
        </button>
      </div>
    );
  }

  const statusStyle = ENC_STATUS_STYLES[encounter.status] ?? ENC_STATUS_STYLES.open;
  const activities = (encounter.activities ?? [])
    .slice()
    .sort((a, b) => new Date(a.performedAt ?? a.createdAt ?? 0).getTime() - new Date(b.performedAt ?? b.createdAt ?? 0).getTime());

  const encDate = new Date(encounter.encounterDate);
  const encDateLabel = encDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const tabStyle = (tab: 'details' | 'activities' | 'claim') => ({
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer' as const,
    background: 'none',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid #0d9488' : '2px solid transparent',
    color: activeTab === tab ? '#0d9488' : '#64748b',
    transition: 'color 0.15s, border-color 0.15s',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', paddingBottom: 48 }}>
      {/* Top nav bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#0d9488', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0 }}>
          ← Back
        </button>
        <div style={{ flex: 1 }} />
        {saving && <span style={{ fontSize: 12, color: '#0d9488', fontWeight: 600 }}>⏳ Saving…</span>}
        <a href={`/api/encounters/${id}/pdf`} target="_blank" rel="noopener noreferrer"
          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#64748b', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
          📄 PDF
        </a>
        <Link href={`/patients/${encounter.patientId}`}
          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          👤 Patient Chart
        </Link>
      </div>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ padding: '20px 32px' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#1a2233' }}>{encounter.chiefComplaint}</span>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 999,
                  background: statusStyle.bg, color: statusStyle.color, textTransform: 'uppercase', whiteSpace: 'nowrap'
                }}>{statusStyle.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#64748b', flexWrap: 'wrap' }}>
                <span>📅 {encDateLabel}</span>
                {encounter.doctorName && <span>👨‍⚕️ {encounter.doctorName}</span>}
                {encounter.nurseName  && <span>👩‍⚕️ {encounter.nurseName}</span>}
                {encounter.waitMinutes != null && <span>⏱ Wait: {encounter.waitMinutes}m</span>}
                {encounter.inServiceMinutes != null && <span>🩺 In-service: {encounter.inServiceMinutes}m</span>}
              </div>
            </div>
            {/* Quick status toggle */}
            <select
              value={encounter.status}
              onChange={e => {
                const newStatus = e.target.value;
                setEncounter(prev => prev ? { ...prev, status: newStatus } : prev);
                patchEncounter({ status: newStatus });
              }}
              style={{ fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: `2px solid ${statusStyle.color}`, color: statusStyle.color, background: statusStyle.bg, cursor: 'pointer' }}
            >
              <option value="open">Open</option>
              <option value="awaiting_md">Awaiting MD</option>
              <option value="signed">Signed</option>
              <option value="complete">Complete</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Tab strip */}
        <div style={{ borderBottom: '1px solid #e2e8f0', padding: '0 32px', display: 'flex', gap: 0 }}>
          <button style={tabStyle('details')} onClick={() => handleTabClick('details')}>
            📋 Details
          </button>
          <button style={tabStyle('activities')} onClick={() => handleTabClick('activities')}>
            📊 Activities ({activities.length})
          </button>
          <button style={tabStyle('claim')} onClick={() => handleTabClick('claim')}>
            💳 Claim
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: activeTab === 'activities' ? 1100 : 900, margin: '24px auto', padding: '0 24px' }}>

        {/* ─── Details Tab ─────────────────────────────────── */}
        {activeTab === 'details' && (
          <DetailsTab
            encounter={encounter}
            encounterId={id}
            doctors={doctors}
            nurses={nurses}
            icd10Options={icd10Options}
            patchEncounter={patchEncounter}
            setEncounter={setEncounter}
          />
        )}

        {/* ─── Activities Tab ───────────────────────────────── */}
        {activeTab === 'activities' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Timeline header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2233' }}>
                📋 Activity Timeline
                <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>({activities.length} activities)</span>
              </div>
              <button
                onClick={() => setShowAddActivity(true)}
                style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                + Add Activity
              </button>
            </div>

            {/* Activities */}
            <div style={{ padding: '0 20px' }}>
              {activities.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: 14 }}>No activities yet</div>
                  <button onClick={() => setShowAddActivity(true)}
                    style={{ marginTop: 12, padding: '6px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Log First Activity
                  </button>
                </div>
              ) : (
                activities.map(a => (
                  <ActivityRow
                    key={a.id}
                    act={a}
                    onUpdated={loadEncounter}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ─── Claim Tab ────────────────────────────────────── */}
        {activeTab === 'claim' && (
          <ClaimTab
            encounter={encounter}
            encounterId={id}
            claim={claim}
            claimLoading={claimLoading}
            claimError={claimError}
            loadClaim={loadClaim}
            onEncounterStatusChange={status => setEncounter(prev => prev ? { ...prev, status } : prev)}
          />
        )}
      </div>

      {showAddActivity && (
        <AddActivityModal
          encounterId={id}
          patientId={encounter.patientId}
          nurseName={encounter.nurseName}
          onClose={() => setShowAddActivity(false)}
          onSaved={() => { setShowAddActivity(false); loadEncounter(); }}
        />
      )}
    </div>
  );
}
