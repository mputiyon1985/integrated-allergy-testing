/**
 * @file app/kiosk/layout.tsx
 * @description Shared layout for all kiosk routes. Fullscreen kiosk mode with
 *   branded header and HIPAA footer. Tap logo 5× to exit fullscreen (staff only).
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasBeenFullscreen, setHasBeenFullscreen] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear tap reset timer on unmount to prevent state-after-unmount
  useEffect(() => {
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  // Track fullscreen state changes
  useEffect(() => {
    function onFsChange() {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) setHasBeenFullscreen(true); // track that we entered fullscreen at least once
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Block keyboard shortcuts that could let patients escape kiosk
  useEffect(() => {
    function blockKeys(e: KeyboardEvent) {
      // Block F11 (fullscreen toggle), F12 (DevTools), F5 (refresh)
      if (e.key === 'F11' || e.key === 'F12' || e.key === 'F5') {
        e.preventDefault(); e.stopPropagation(); return false;
      }
      // Block Ctrl+W (close tab), Ctrl+T (new tab), Ctrl+N (new window)
      // Block Ctrl+R (refresh), Ctrl+L (address bar), Ctrl+U (view source)
      if (e.ctrlKey && ['w','t','n','r','l','u','j'].includes(e.key.toLowerCase())) {
        e.preventDefault(); e.stopPropagation(); return false;
      }
      // Block Alt+F4 (close window), Alt+Tab (switch app)
      if (e.altKey && (e.key === 'F4' || e.key === 'Tab')) {
        e.preventDefault(); e.stopPropagation(); return false;
      }
    }

    // Block right-click context menu
    function blockContext(e: MouseEvent) {
      e.preventDefault(); return false;
    }

    document.addEventListener('keydown', blockKeys, true);
    document.addEventListener('contextmenu', blockContext, true);

    return () => {
      document.removeEventListener('keydown', blockKeys, true);
      document.removeEventListener('contextmenu', blockContext, true);
    };
  }, []);

  // Enter fullscreen on first interaction
  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch { /* browser may deny */ }
  }, []);

  // Tap logo 5× quickly to exit fullscreen (staff escape hatch)
  function handleLogoTap() {
    setLogoTaps(prev => {
      const next = prev + 1;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (next >= 5) {
        document.exitFullscreen?.().catch(() => {});
        return 0;
      }
      tapTimer.current = setTimeout(() => setLogoTaps(0), 3000);
      return next;
    });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Fullscreen guard overlay — only shown AFTER patient was already fullscreen */}
      {!isFullscreen && hasBeenFullscreen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 20,
        }}>
          <div style={{ fontSize: 64 }}>🔒</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', textAlign: 'center' }}>
            Please ask a staff member for assistance
          </div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: 400 }}>
            This kiosk is in protected mode
          </div>
          <button
            onClick={enterFullscreen}
            style={{
              marginTop: 12, padding: '16px 40px',
              background: '#0d9488', color: '#fff',
              border: 'none', borderRadius: 12,
              fontSize: 18, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ↩ Return to Kiosk
          </button>
        </div>
      )}
      {/* Header */}
      <div style={{ background: '#0055A5', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/integrated-allergy-logo.jpg"
            alt="Integrated Allergy Testing"
            style={{ height: 40, width: 'auto', cursor: 'pointer', userSelect: 'none' }}
            onClick={handleLogoTap}
            title="Tap 5× to exit fullscreen"
          />
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>Patient Check-In</span>
        </div>

        {/* Fullscreen button — shown when not fullscreen */}
        {!isFullscreen && (
          <button
            onClick={enterFullscreen}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ⛶ Fullscreen
          </button>
        )}
        {logoTaps > 0 && logoTaps < 5 && (
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
            {5 - logoTaps} more tap{5 - logoTaps !== 1 ? 's' : ''} to exit
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {children}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 24px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
        🔐 HIPAA Compliant · Integrated Allergy Testing
      </div>
    </div>
  );
}
