'use client';
export default function KioskError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ color: '#dc2626', marginBottom: 12, fontSize: 24 }}>Something went wrong.</h2>
      <p style={{ color: '#64748b', marginBottom: 24, fontSize: 18 }}>Please ask staff for help.</p>
      <button onClick={reset} style={{ padding: '12px 28px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
        Try again
      </button>
    </div>
  );
}
