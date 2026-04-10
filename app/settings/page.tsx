'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Layout, ResponsiveLayouts } from 'react-grid-layout';
import UsersManagement from '@/components/settings/UsersManagement';
import AppManualTab from '@/components/settings/AppManualTab';
import RolesManagement from '@/components/settings/RolesManagement';
import AuditLogTab from '@/components/settings/AuditLogTab';
import ServicesTab from '@/components/settings/ServicesTab';
import EmailTab from '@/components/settings/EmailTab';

const DashboardGrid = dynamic(() => import('@/components/DashboardGrid'), { ssr: false });
const DoctorsTab = dynamic(() => import('@/components/settings/DoctorsTab'), { ssr: false });
const NursesTab = dynamic(() => import('@/components/settings/NursesTab'), { ssr: false });
const VideosTab = dynamic(() => import('@/components/settings/VideosTab'), { ssr: false });
const AllergensTab = dynamic(() => import('@/components/settings/AllergensTab'), { ssr: false });
const PracticesTab = dynamic(() => import('@/components/settings/PracticesTab'), { ssr: false });
const LocationsTab = dynamic(() => import('@/components/settings/LocationsTab'), { ssr: false });

const SETTINGS_LAYOUT_KEY = 'iat-settings-layout-v1';

const SECTION_IDS = [
  'clinic-info',
  'system-status',
  'app-version',
  'quick-links',
] as const;

type SectionId = typeof SECTION_IDS[number];

interface MutableLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

function buildDefaultLayouts(): ResponsiveLayouts {
  const lg: MutableLayoutItem[] = SECTION_IDS.map((id, i) => ({
    i: id,
    x: (i % 2) * 6,
    y: Math.floor(i / 2) * 12,
    w: 6,
    h: 12,
    minW: 3,
    minH: 6,
  }));
  const fullWidth: SectionId[] = [];
  lg.forEach(item => {
    if (fullWidth.includes(item.i as SectionId)) {
      item.x = 0;
      item.w = 12;
      item.h = 18;
    }
  });
  let currentY = 0;
  let pendingHalf: MutableLayoutItem | null = null;
  const result: MutableLayoutItem[] = [];
  for (const item of lg) {
    if (item.w === 12) {
      if (pendingHalf) {
        pendingHalf.y = currentY;
        result.push(pendingHalf);
        currentY += pendingHalf.h;
        pendingHalf = null;
      }
      item.y = currentY;
      result.push(item);
      currentY += item.h;
    } else {
      if (!pendingHalf) {
        item.x = 0;
        item.y = currentY;
        pendingHalf = item;
      } else {
        item.x = 6;
        item.y = currentY;
        result.push(pendingHalf);
        result.push(item);
        currentY += Math.max(pendingHalf.h, item.h);
        pendingHalf = null;
      }
    }
  }
  if (pendingHalf) {
    result.push(pendingHalf);
  }

  let smY = 0;
  const smResult: MutableLayoutItem[] = result.map(item => {
    const r: MutableLayoutItem = { ...item, x: 0, w: 6, y: smY };
    smY += item.h;
    return r;
  });

  return { lg: result as unknown as Layout, sm: smResult as unknown as Layout };
}

const DEFAULT_SETTINGS_LAYOUTS = buildDefaultLayouts();

function loadSettingsLayouts(): ResponsiveLayouts {
  try {
    const saved = localStorage.getItem(SETTINGS_LAYOUT_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_SETTINGS_LAYOUTS;
}

type CurrentUser = { id: string; role: string; email: string; name: string };
type SettingsTab = 'dashboard' | 'roles' | 'users' | 'audit' | 'services' | 'doctors' | 'nurses' | 'videos' | 'allergens' | 'practices' | 'locations' | 'manual' | 'email';

export default function SettingsPage() {
  const [editMode, setEditMode] = useState(false);
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(DEFAULT_SETTINGS_LAYOUTS);
  const [activeTab, setActiveTab] = useState<SettingsTab>('dashboard');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    setLayouts(loadSettingsLayouts());
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setCurrentUser(u); })
      .catch(() => {});
  }, []);

  function handleLayoutChange(_layout: Layout, allLayouts: ResponsiveLayouts): void {
    setLayouts(allLayouts);
    if (editMode) {
      try { localStorage.setItem(SETTINGS_LAYOUT_KEY, JSON.stringify(allLayouts)); } catch {}
    }
  }

  const tileStyle = (overrideColor?: string): React.CSSProperties => ({
    height: '100%',
    overflow: 'auto',
    border: editMode ? `2px dashed ${overrideColor ?? '#f59e0b'}` : '1px solid #e2e8f0',
    borderRadius: 12,
    background: '#fff',
    padding: 20,
    boxSizing: 'border-box',
  });

  const isAdmin = currentUser?.role === 'admin';

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    borderRadius: '8px 8px 0 0',
    border: '1px solid #e2e8f0',
    borderBottom: active ? '1px solid #fff' : '1px solid #e2e8f0',
    background: active ? '#fff' : '#f8fafc',
    color: active ? '#1e293b' : '#64748b',
    fontWeight: active ? 700 : 500,
    fontSize: 13,
    cursor: 'pointer',
    marginBottom: -1,
    transition: 'all 0.15s',
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">System configuration and administration</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'dashboard' && (
            <button onClick={() => setEditMode(v => !v)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${editMode ? '#f59e0b' : '#e2e8f0'}`, background: editMode ? '#fefce8' : '#fff', color: editMode ? '#b45309' : '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {editMode ? '✅ Done' : '⊞ Edit Layout'}
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 20, flexWrap: 'wrap' }}>
          <button style={TAB_STYLE(activeTab === 'dashboard')} onClick={() => setActiveTab('dashboard')}>
            ⚙️ Dashboard
          </button>
          {isAdmin && (
            <button style={TAB_STYLE(activeTab === 'roles')} onClick={() => setActiveTab('roles')}>
              🔐 Roles
            </button>
          )}
          {isAdmin && (
            <button style={TAB_STYLE(activeTab === 'users')} onClick={() => setActiveTab('users')}>
              👥 Users
            </button>
          )}
          <button style={TAB_STYLE(activeTab === 'practices')} onClick={() => setActiveTab('practices')}>
            🏢 Practices
          </button>
          <button style={TAB_STYLE(activeTab === 'locations')} onClick={() => setActiveTab('locations')}>
            📍 Locations
          </button>
          <button style={TAB_STYLE(activeTab === 'doctors')} onClick={() => setActiveTab('doctors')}>
            👨‍⚕️ Doctors
          </button>
          <button style={TAB_STYLE(activeTab === 'nurses')} onClick={() => setActiveTab('nurses')}>
            👩‍⚕️ Nurses
          </button>
          <button style={TAB_STYLE(activeTab === 'services')} onClick={() => setActiveTab('services')}>
            🎨 Services
          </button>
          <button style={TAB_STYLE(activeTab === 'videos')} onClick={() => setActiveTab('videos')}>
            🎬 Videos
          </button>
          <button style={TAB_STYLE(activeTab === 'allergens')} onClick={() => setActiveTab('allergens')}>
            🧪 Allergens
          </button>
          <button style={TAB_STYLE(activeTab === 'audit')} onClick={() => setActiveTab('audit')}>
            📋 Audit Log
          </button>
          <button style={TAB_STYLE(activeTab === 'manual')} onClick={() => setActiveTab('manual')}>
            📘 App Manual
          </button>
          <button style={TAB_STYLE(activeTab === 'email')} onClick={() => setActiveTab('email')}>
            📧 Email
          </button>
        </div>

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
            <RolesManagement />
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && currentUser && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
            <UsersManagement currentUser={currentUser} />
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && <AuditLogTab />}

        {/* App Manual Tab */}
        {activeTab === 'manual' && <AppManualTab />}

        {/* Email Tab */}
        {activeTab === 'email' && <EmailTab />}

        {/* Services Tab */}
        {activeTab === 'services' && <ServicesTab />}

        {/* Practices Tab */}
        {activeTab === 'practices' && <PracticesTab />}

        {/* Locations Tab */}
        {activeTab === 'locations' && <LocationsTab />}

        {/* Doctors Tab */}
        {activeTab === 'doctors' && <DoctorsTab />}

        {/* Nurses Tab */}
        {activeTab === 'nurses' && <NursesTab />}

        {/* Videos Tab */}
        {activeTab === 'videos' && <VideosTab />}

        {/* Allergens Tab */}
        {activeTab === 'allergens' && <AllergensTab />}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
            {editMode && (
              <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 16px', marginBottom: 8, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                ⊞ Drag tiles to move · Drag bottom-right corner to resize · Click <strong>&quot;✅ Done&quot;</strong> to save
              </div>
            )}

            <DashboardGrid
              layouts={layouts}
              editMode={editMode}
              onLayoutChange={handleLayoutChange}
              tiles={[
                {
                  id: 'system-status',
                  content: (
                    <div style={tileStyle()}>
                      <div className="card-title">System Status</div>
                      <div className="flex flex-col gap-3">
                        {[
                          { label: 'API Server', status: 'Operational', badge: 'badge-teal' },
                          { label: 'Database', status: 'Operational', badge: 'badge-teal' },
                          { label: 'Allergen Data', status: 'Loaded', badge: 'badge-green' },
                          { label: 'Video Service', status: 'Operational', badge: 'badge-teal' },
                        ].map(s => (
                          <div key={s.label} className="flex justify-between items-center" style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: 14 }}>{s.label}</span>
                            <span className={`badge ${s.badge}`}>{s.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'app-version',
                  content: (
                    <div style={tileStyle()}>
                      <div className="card-title">Application Version</div>
                      <div className="flex flex-col gap-2">
                        {[
                          { label: 'Version', value: '3.4.2' },
                          { label: 'Environment', value: 'Production' },
                          { label: 'Last Updated', value: new Date().toLocaleDateString() },
                        ].map(r => (
                          <div key={r.label} className="flex justify-between items-center" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 14 }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>{r.label}</span>
                            <span>{r.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'quick-links',
                  content: (
                    <div style={tileStyle()}>
                      <div className="card-title">Quick Links</div>
                      <div className="flex flex-col gap-2">
                        <Link href="/patients/new" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>👤 Register New Patient</Link>
                        <Link href="/testing" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>🧪 Start Testing Session</Link>
                        <Link href="/videos" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>🎬 Manage Videos</Link>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </>
        )}
      </div>
    </>
  );
}
