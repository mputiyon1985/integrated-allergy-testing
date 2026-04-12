'use client'
import { useState, useEffect } from 'react'

interface InactivityModalProps {
  isOpen: boolean
  secondsLeft: number
  onStayLoggedIn: () => void
  onLogout: () => void
}

export default function InactivityModal({
  isOpen,
  secondsLeft: initialSeconds,
  onStayLoggedIn,
  onLogout,
}: InactivityModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)

  // Reset countdown whenever modal opens
  useEffect(() => {
    if (!isOpen) return
    setSecondsLeft(initialSeconds)

    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          onLogout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const progressPct = (secondsLeft / initialSeconds) * 100

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.18)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
            padding: '20px 24px 16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 6 }}>⏱</div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.01em',
            }}
          >
            Session Expiring Soon
          </h2>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 24px 20px' }}>
          <p
            style={{
              fontSize: 14,
              color: '#1a2233',
              textAlign: 'center',
              lineHeight: 1.6,
              margin: '0 0 20px',
            }}
          >
            You&apos;ve been inactive for 13 minutes. You will be automatically
            logged out in{' '}
            <strong style={{ color: secondsLeft <= 30 ? '#dc2626' : '#0d9488' }}>
              {secondsLeft}
            </strong>{' '}
            second{secondsLeft !== 1 ? 's' : ''}.
          </p>

          {/* Progress bar */}
          <div
            style={{
              height: 6,
              background: '#e2e8f0',
              borderRadius: 99,
              marginBottom: 24,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                background:
                  progressPct > 30
                    ? '#0d9488'
                    : progressPct > 10
                    ? '#f59e0b'
                    : '#dc2626',
                borderRadius: 99,
                transition: 'width 1s linear, background 0.5s ease',
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onStayLoggedIn}
              style={{
                flex: 1,
                padding: '12px',
                background: '#0d9488',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0f766e')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0d9488')}
            >
              ✅ Stay Logged In
            </button>
            <button
              onClick={onLogout}
              style={{
                flex: 1,
                padding: '12px',
                background: '#f1f5f9',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f1f5f9')}
            >
              🚪 Log Out Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
