'use client';

import './globals.css';
import Link from 'next/link';
import { LocationSelector } from '@/components/LocationSelector';
import { SidebarLocationSelector } from '@/components/SidebarLocationSelector';
import { HeaderLocationSelector } from '@/components/HeaderLocationSelector';
import { apiFetch } from '@/lib/api-fetch';
import { getAuthUser } from '@/lib/auth-cache';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import DemoRoleBanner from '@/components/DemoRoleBanner';

import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useInactivityTimeout } from '@/lib/useInactivityTimeout';
import InactivityModal from '@/components/InactivityModal';

type NavItem = { href: string; label: string; icon: string; children?: NavItem[] };

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/patients', label: 'Patients', icon: '👥' },
  { href: '/encounters', label: 'Encounters', icon: '📋' },
  { href: '/claims', label: 'Claims', icon: '💳' },
  { href: '/reports', label: 'Reports', icon: '📊' },
  { href: '/testing', label: 'Testing', icon: '🧪' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/insurance', label: 'Insurance Hub', icon: '🏥' },
  { href: '/kiosk', label: 'Kiosk', icon: '📲' },
];

const bottomNavItems = [
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

// UserCard removed — Sign Out is in top-right user menu

// Nav items hidden per role
const ROLE_HIDDEN_NAV: Record<string, string[]> = {
  clinical_staff: ['/claims', '/reports', '/insurance', '/kiosk', '/settings'],
  front_desk: ['/reports', '/claims'],
  billing: ['/kiosk', '/testing'],
  provider: ['/kiosk', '/settings'],
};

function Sidebar({ open, onClose, userName, userRole }: { open: boolean; onClose: () => void; userName: string; userRole: string }) {
  const hiddenPaths = ROLE_HIDDEN_NAV[userRole] ?? [];
  const visibleNavItems = navItems.filter(item => !hiddenPaths.includes(item.href));
  const visibleBottomItems = bottomNavItems.filter(item => !hiddenPaths.includes(item.href));
  const pathname = usePathname();

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <nav className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/integrated-allergy-logo.jpg"
            alt="Integrated Allergy Testing"
            style={{ height: 55, width: 'auto', display: 'block' }}
          />
          <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 4 }}>Testing Suite v3.7.0</div>
        </div>

        <div className="sidebar-nav">
          <div className="nav-label">Navigation</div>
          {visibleNavItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            // Kiosk opens in a new tab
            if (item.href === '/kiosk') {
              return (
                <button
                  key={item.href}
                  className="nav-link"
                  style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}
                  onClick={() => {
                    onClose();
                    // Open kiosk as a popup with no toolbar/controls
                    const w = window.open(
                      '/kiosk',
                      'kiosk',
                      `width=${screen.width},height=${screen.height},left=0,top=0,toolbar=no,menubar=no,scrollbars=no,status=no,location=no`
                    );
                    if (w) {
                      w.moveTo(0, 0);
                      w.resizeTo(screen.width, screen.height);
                      w.addEventListener('load', () => {
                        w.document.documentElement.requestFullscreen?.().catch(() => {});
                      });
                    }
                  }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4, background: '#0d9488', color: '#fff', padding: '1px 5px', borderRadius: 4 }}>LAUNCH</span>
                </button>
              );
            }
            // Group with children — hover to expand, auto-collapse on mouse-out
            if (item.children) {
              const groupActive = item.children.some(c => pathname.startsWith(c.href));
              return (
                <div
                  key={item.href}
                  style={{ position: 'relative' }}
                  onMouseEnter={e => { const el = e.currentTarget.querySelector('[data-submenu]') as HTMLElement; if (el) el.style.display = 'block'; }}
                  onMouseLeave={e => { const el = e.currentTarget.querySelector('[data-submenu]') as HTMLElement; if (el && !groupActive) el.style.display = 'none'; }}
                >
                  <div className={`nav-link ${groupActive ? 'active' : ''}`} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="nav-icon">{item.icon}</span>
                      {item.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>▾</span>
                  </div>
                  <div
                    data-submenu
                    style={{ display: groupActive ? 'block' : 'none', paddingLeft: 14, borderLeft: '2px solid #e2e8f0', marginLeft: 20, marginBottom: 4 }}
                  >
                    {item.children.map(child => {
                      const childActive = child.href === '/' ? pathname === '/' : pathname === child.href || (child.href !== '/practices' && pathname.startsWith(child.href));
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`nav-link ${childActive ? 'active' : ''}`}
                          onClick={onClose}
                          style={{ fontSize: 13, padding: '5px 10px' }}
                        >
                          <span className="nav-icon" style={{ fontSize: 13 }}>{child.icon}</span>
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        

        {/* Settings at bottom — above copyright */}
        <div style={{ padding: '4px 8px' }}>
          {visibleBottomItems.map(item => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="sidebar-footer">
          © 2026 Integrated Allergy Testing
        </div>
      </nav>
    </>
  );
}

const DEMO_ROLES = [
  { label: '👨‍⚕️ Provider',       email: 'demo.provider@iat-demo.com' },
  { label: '💉 Clinical Staff',  email: 'demo.nurse@iat-demo.com' },
  { label: '🗓 Front Desk',      email: 'demo.frontdesk@iat-demo.com' },
  { label: '💳 Billing',         email: 'demo.billing@iat-demo.com' },
  { label: '🏢 Office Manager',  email: 'demo.manager@iat-demo.com' },
];

function TopBar({ userName, userRole }: { userName: string; userRole: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function switchToRole(email: string) {
    setSwitching(true);
    setMenuOpen(false);
    try {
      // Use switch-role so admin session is backed up for restore
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: email, password: 'demo1234' }),
      });
      if (res.ok) {
        const data = await res.json();
        // Clear localStorage so stale admin name/role don't flash on reload
        try { localStorage.removeItem('iat_user'); } catch {}
        // Small delay to ensure cookie is set before navigate
        await new Promise(r => setTimeout(r, 100));
        window.location.href = '/';
      } else {
        const d = await res.json().catch(() => ({}));
        console.error('switch-role failed:', res.status, d);
        alert('Role switch failed: ' + (d.error ?? res.status));
        setSwitching(false);
      }
    } catch (e) { console.error(e); setSwitching(false); }
  }

  async function switchToAdmin() {
    setSwitching(true);
    setMenuOpen(false);
    try {
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnToAdmin: true }),
      });
      if (res.ok) window.location.href = '/';
    } catch {} finally { setSwitching(false); }
  }

  const isAdmin = userRole === 'admin';
  const isDemo = ['provider','clinical_staff','front_desk','billing','office_manager'].includes(userRole);

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 200,
      background: '#fff', borderBottom: '1px solid #e2e8f0',
      height: 48, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 24px',
    }}>
      <div />

      {/* Right side: Location breadcrumb + divider + user card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Location breadcrumb */}
        <HeaderLocationSelector />

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />

        {/* User card with role switcher */}
        {userName && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              disabled={switching}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: '#374151', fontWeight: 500,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 8px', borderRadius: 6,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: isDemo ? '#7c3aed' : '#0d9488',
                color: '#fff', fontWeight: 700, fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {switching ? '…' : userName.charAt(0).toUpperCase()}
              </div>
              <span>{userName}</span>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>▾</span>
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200, zIndex: 999,
                  overflow: 'hidden',
                }}
                onMouseLeave={() => setMenuOpen(false)}
              >
                {/* Current user info */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>{userName}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>{userRole?.replace('_', ' ')}</div>
                </div>

                {/* Role switcher — only for admin or demo roles */}
                {(isAdmin || isDemo) && (
                  <>
                    <div style={{ padding: '6px 14px 4px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🎭 Preview as role
                    </div>
                    {DEMO_ROLES.map(r => (
                      <button
                        key={r.email}
                        onClick={() => switchToRole(r.email)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '7px 14px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 13, color: '#374151',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        {r.label}
                      </button>
                    ))}
                    {isDemo && (
                      <button
                        onClick={switchToAdmin}
                        style={{
                          width: '100%', textAlign: 'left', padding: '7px 14px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 13, color: '#dc2626', fontWeight: 600,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        🔑 Return to Admin
                      </button>
                    )}
                    <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                  </>
                )}

                {/* Logout */}
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    try { localStorage.removeItem('iat_user'); localStorage.removeItem('iat_active_location'); } catch {}
                    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
                    window.location.href = '/login';
                  }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: '#6b7280',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  🚪 Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState(() => { try { return JSON.parse(localStorage.getItem('iat_user') ?? '{}')?.name ?? ''; } catch { return ''; } });
  const [userRole, setUserRole] = useState(() => { try { return JSON.parse(localStorage.getItem('iat_user') ?? '{}')?.role ?? ''; } catch { return ''; } });
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname?.startsWith('/login') || pathname === '/consent' || pathname?.startsWith('/consent') || pathname?.startsWith('/kiosk');

  // ── Inactivity timeout state ──────────────────────────────────────────────
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutSeconds] = useState(120);

  const handleAutoLogout = useCallback(async () => {
    setShowTimeoutWarning(false);
    try { localStorage.removeItem('iat_user'); localStorage.removeItem('iat_active_location'); } catch {}
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login?reason=timeout';
  }, []);

  useInactivityTimeout(
    () => { setShowTimeoutWarning(true); },
    handleAutoLogout,
    !isAuthPage,
  );

  // Load user ONCE at mount — persists across all page navigations (AppShell never unmounts)
  useEffect(() => {
    if (isAuthPage) return;
    // Read cache immediately for instant display
    try { const c = localStorage.getItem('iat_user'); if (c) setUserName(JSON.parse(c)?.name ?? ''); } catch {}
    // Refresh from API in background (uses shared cache — deduped across components)
    getAuthUser().then(u => {
      if (u?.name) {
        setUserName(u.name);
        if (u?.role) setUserRole(u.role);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps — run once on mount only

  // Close sidebar on route change
  useEffect(() => { Promise.resolve().then(() => setSidebarOpen(false)); }, [pathname]);

  // Auto-refresh JWT every 6 hours
  useEffect(() => {
    if (isAuthPage) return;
    const interval = setInterval(() => {
      apiFetch('/api/auth/refresh', { method: 'POST' }).catch(() => {});
    }, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthPage]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <button className="sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle navigation">☰</button>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} userName={userName} userRole={userRole} />
      <div className="main-content">
        <TopBar userName={userName} userRole={userRole} />
        {children}
      </div>
      <InactivityModal
        isOpen={showTimeoutWarning}
        secondsLeft={timeoutSeconds}
        onStayLoggedIn={() => setShowTimeoutWarning(false)}
        onLogout={handleAutoLogout}
      />
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Integrated Allergy Testing</title>
      </head>
      <body>
        <ErrorBoundary>
          <AppShell>{children}</AppShell>
          <DemoRoleBanner />
        </ErrorBoundary>
      </body>
    </html>
  );
}
