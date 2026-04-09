'use client';

import './globals.css';
import Link from 'next/link';
import { LocationSelector } from '@/components/LocationSelector';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/patients', label: 'Patients', icon: '👥' },
  { href: '/testing', label: 'Testing', icon: '🧪' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/insurance', label: 'Insurance', icon: '🏥' },

  { href: '/doctors', label: 'Doctors', icon: '👨‍⚕️' },
  { href: '/nurses', label: 'Nurses', icon: '👩‍⚕️' },
  { href: '/locations', label: 'Locations', icon: '📍' },
  { href: '/videos', label: 'Videos', icon: '🎬' },
  { href: '/kiosk', label: 'Kiosk', icon: '📲' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

function UserCard() {
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.user) setUser(d.user);
    }).catch(() => {});
  }, []);

  if (!user) return null;

  return (
    <div style={{ margin: '0 8px 8px', padding: '10px 12px', background: 'linear-gradient(135deg, #e8f9f7, #d0f4ef)', border: '1.5px solid #2ec4b6', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2ec4b6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0d9488', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>{user.role}</div>
        </div>
      </div>
      <button onClick={async () => {
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          // Also sign out of NextAuth (SSO sessions)
          window.location.href = '/api/auth/signout?callbackUrl=/login';
        }}
        style={{ marginTop: 8, width: '100%', padding: '4px 0', fontSize: 11, color: '#dc2626', background: 'transparent', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
        Sign Out
      </button>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 4 }}>Testing Suite v3.1.0</div>
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

        <UserCard />

        {/* Sign Out — above the footer line */}
        <div style={{ padding: '0 12px 10px' }}>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
              window.location.href = '/api/auth/signout?callbackUrl=/login';
            }}
            style={{
              width: '100%',
              padding: '8px 0',
              background: 'rgba(255,255,255,0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🚪 Sign Out
          </button>
        </div>

        <div className="sidebar-footer">
          © 2026 Integrated Allergy Testing
        </div>
      </nav>
    </>
  );
}

function TopBar() {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user?.name) setUserName(d.user.name); })
      .catch(() => {});
  }, []);

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
      justifyContent: 'flex-end',
      padding: '0 24px',
      gap: 16,
    }}>
      <LocationSelector />
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
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname?.startsWith('/login') || pathname === '/consent' || pathname?.startsWith('/consent') || pathname?.startsWith('/kiosk');

  // Close sidebar on route change — deferred to avoid synchronous setState-in-effect
  useEffect(() => { Promise.resolve().then(() => setSidebarOpen(false)); }, [pathname]);

  // Auto-refresh JWT every 6 hours (expires at 8h) — silent token rotation
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
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <TopBar />
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
