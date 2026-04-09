'use client';

import './globals.css';
import Link from 'next/link';
import { LocationSelector } from '@/components/LocationSelector';
import { SidebarLocationSelector } from '@/components/SidebarLocationSelector';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

type NavItem = { href: string; label: string; icon: string; children?: NavItem[] };

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/patients', label: 'Patients', icon: '👥' },
  { href: '/testing', label: 'Testing', icon: '🧪' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/insurance', label: 'Insurance Hub', icon: '🏥' },

  { href: '/kiosk', label: 'Kiosk', icon: '📲' },
];

const bottomNavItems = [
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

function UserCard({ userName }: { userName: string }) {
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    try { const c = localStorage.getItem('iat_user'); if (c) setUser(JSON.parse(c)); } catch {}
  }, [userName]); // re-read cache when userName updates

  if (!user && !userName) return null;
  const displayName = user?.name ?? userName;

  return (
    <div style={{ margin: '0 8px 8px', padding: '10px 12px', background: 'linear-gradient(135deg, #e8f9f7, #d0f4ef)', border: '1.5px solid #2ec4b6', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2ec4b6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0d9488', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>{user?.role ?? ''}</div>
        </div>
      </div>
      <button onClick={async () => {
          try { localStorage.removeItem('iat_user'); localStorage.removeItem('iat_active_location'); } catch {}
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          window.location.href = '/api/auth/signout?callbackUrl=/login';
        }}
        style={{ marginTop: 8, width: '100%', padding: '4px 0', fontSize: 11, color: '#dc2626', background: 'transparent', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
        Sign Out
      </button>
    </div>
  );
}

function Sidebar({ open, onClose, userName }: { open: boolean; onClose: () => void; userName: string }) {
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
          <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 4 }}>Testing Suite v3.4.2</div>
        </div>

        <div className="sidebar-nav">
          <div className="nav-label">Navigation</div>
          {navItems.map((item) => {
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

        {/* Practice / Location switcher */}
        <div style={{ margin: '0 8px 8px', padding: '12px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <SidebarLocationSelector />
        </div>

        <UserCard userName={userName} />

        {/* Settings at bottom — above copyright */}
        <div style={{ padding: '4px 8px' }}>
          {bottomNavItems.map(item => {
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

function TopBar({ userName }: { userName: string }) {

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 200,
      background: '#fff',
      borderBottom: '1px solid #e2e8f0',
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
    }}>
      {/* Left: Practice + Location */}
      <LocationSelector />

      {/* Right: User name */}
      {userName && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: '#374151',
          fontWeight: 500,
        }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#0d9488',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <span>{userName}</span>
        </div>
      )}
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname?.startsWith('/login') || pathname === '/consent' || pathname?.startsWith('/consent') || pathname?.startsWith('/kiosk');

  // Load user ONCE at mount — persists across all page navigations (AppShell never unmounts)
  useEffect(() => {
    if (isAuthPage) return;
    // Read cache immediately for instant display
    try { const c = localStorage.getItem('iat_user'); if (c) setUserName(JSON.parse(c)?.name ?? ''); } catch {}
    // Refresh from API in background
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      const u = d?.user ?? d;
      if (u?.name) {
        setUserName(u.name);
        try { localStorage.setItem('iat_user', JSON.stringify(u)); } catch {}
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
      fetch('/api/auth/refresh', { method: 'POST' }).catch(() => {});
    }, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthPage]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <button className="sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle navigation">☰</button>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} userName={userName} />
      <div className="main-content">
        <TopBar userName={userName} />
        {children}
      </div>
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
