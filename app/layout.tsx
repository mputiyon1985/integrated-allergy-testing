'use client';

import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/patients', label: 'Patients', icon: '👥' },
  { href: '/testing', label: 'Testing', icon: '🧪' },
  { href: '/videos', label: 'Videos', icon: '🎬' },
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
      <button onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location.href = '/login')}
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
          <Image
            src="/integrated-allergy-logo.jpg"
            alt="Integrated Allergy Testing"
            width={160}
            height={55}
            style={{ height: 55, width: 'auto', display: 'block' }}
            priority
          />
          <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 4 }}>Testing Suite v1.0</div>
        </div>

        <div className="sidebar-nav">
          <div className="nav-label">Navigation</div>
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
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
        <div className="sidebar-footer">
          © 2026 Integrated Allergy Testing
        </div>
      </nav>
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Integrated Allergy Testing</title>
      </head>
      <body>
        <div className="app-shell">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>

          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="main-content">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
