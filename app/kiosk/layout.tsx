export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#0055A5', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/integrated-allergy-logo.jpg" alt="Integrated Allergy Testing" style={{ height: 40, width: 'auto' }} />
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>Patient Check-In</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {children}
      </div>
      <div style={{ padding: '12px 24px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
        🔐 HIPAA Compliant · Integrated Allergy Testing
      </div>
    </div>
  );
}
