'use client';
export default function PatientsError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <h2 style={{ color: '#dc2626', marginBottom: 8 }}>Error loading patients</h2>
      <p style={{ color: '#64748b', marginBottom: 20 }}>{process.env.NODE_ENV === 'development' ? error.message : 'Please try again or contact support.'}</p>
      <button onClick={reset} style={{ padding: '8px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
        Try again
      </button>
    </div>
  );
}
