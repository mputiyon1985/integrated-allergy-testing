'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function DonePage() {
  const [patientName, setPatientName] = useState<string>('')
  const [currentTime, setCurrentTime] = useState<string>('')

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

    // Auto-add to waiting room
    if (patientId && name) {
      fetch('/api/waiting-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, patientName: name }),
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

        {/* Start over */}
        <Link href="/kiosk" style={styles.startOver}>
          Start Over (New Patient)
        </Link>
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
