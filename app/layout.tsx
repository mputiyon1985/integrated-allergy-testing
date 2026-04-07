'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/patients', label: 'Patients', icon: '👥' },
  { href: '/testing', label: 'Testing', icon: '🧪' },
  { href: '/videos', label: 'Videos', icon: '🎬' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <nav className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <div className="sidebar-logo-icon">🩺</div>
            <div className="sidebar-logo-text">Integrated Allergy<br />Testing</div>
          </div>
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

        <div className="sidebar-footer">
          Integrated Allergy Testing v1.0
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
