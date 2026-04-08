'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DonePage() {
  const router = useRouter()
  const [patientName, setPatientName] = useState<string>('')
  const [currentTime, setCurrentTime] = useState<string>('')
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    const raw = sessionStorage.getItem('kiosk_patient') || ''
    let name = raw
    let patientId = ''
    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw)
        name = parsed.name || [parsed.firstName, parsed.lastName].filter(Boolean).join(' ') || raw
        patientId = parsed.id || ''
      } catch {
        name = raw
      }
    }
    setPatientName(name)

    // Auto-add to waiting room with video count
    if (patientId && name) {
      const watchedRaw = sessionStorage.getItem('kiosk_videos_watched') || '0';
      const videosWatched = parseInt(watchedRaw, 10) || 0;
      fetch('/api/waiting-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, patientName: name, videosWatched }),
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    function tick() {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  // 30-second countdown then reset for next patient
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          sessionStorage.removeItem('kiosk_patient')
          sessionStorage.removeItem('kiosk_dob')
          sessionStorage.removeItem('kiosk_lookup')
          router.push('/kiosk')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [router])

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Animated checkmark */}
        <div style={styles.checkWrap}>
          <span style={styles.checkEmoji}>✅</span>
        </div>

        {/* Thank you */}
        <h1 style={styles.thankYou}>
          Thank you{patientName ? `, ${patientName}` : ''}!
        </h1>

        {/* Subtitle */}
        <p style={styles.subtitle}>Please have a seat.</p>

        {/* Staff message */}
        <p style={styles.message}>
          A member of our staff will call you when we are ready for you.
        </p>

        {/* Live clock */}
        <div style={styles.clock}>{currentTime}</div>

        {/* Countdown */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 14, color: '#64748b' }}>
            Returning to start in <strong style={{ color: countdown <= 5 ? '#dc2626' : '#0d9488', fontSize: 18 }}>{countdown}</strong> seconds…
          </div>
          {/* Progress bar */}
          <div style={{ width: 200, height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: countdown <= 5 ? '#dc2626' : '#0d9488', width: `${(countdown / 10) * 100}%`, transition: 'width 1s linear, background 0.3s' }} />
          </div>
          <button onClick={() => { sessionStorage.removeItem('kiosk_patient'); sessionStorage.removeItem('kiosk_dob'); sessionStorage.removeItem('kiosk_lookup'); router.push('/kiosk'); }}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', textDecoration: 'underline', padding: '4px 0' }}>
            Start Over Now
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        .check-pulse {
          animation: pulse 2.2s ease-in-out infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#e8f9f7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: '56px 48px 40px',
    maxWidth: 600,
    width: '100%',
    boxShadow: '0 6px 32px rgba(0,0,0,0.09)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  checkWrap: {
    marginBottom: 24,
  },
  checkEmoji: {
    fontSize: 100,
    lineHeight: 1,
    display: 'inline-block',
    // Pulse applied via className below via a wrapper trick
    animation: 'pulse 2.2s ease-in-out infinite',
  },
  thankYou: {
    fontSize: 36,
    fontWeight: 700,
    color: '#1a4d3e',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 26,
    fontWeight: 600,
    color: '#2e7d6b',
    marginBottom: 16,
  },
  message: {
    fontSize: 20,
    color: '#555',
    lineHeight: 1.6,
    marginBottom: 36,
    maxWidth: 440,
  },
  clock: {
    fontSize: 48,
    fontWeight: 300,
    color: '#0055A5',
    letterSpacing: '0.04em',
    marginBottom: 48,
    fontVariantNumeric: 'tabular-nums',
  },
  startOver: {
    fontSize: 14,
    color: '#aaa',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
}
