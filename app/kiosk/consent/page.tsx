'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ConsentForm {
  id: string
  title: string
  template: string
}

interface CheckResponse {
  allSigned: boolean
  forms: ConsentForm[]
  signedIds: string[]
}

export default function ConsentPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [patientId, setPatientId] = useState<string | null>(null)
  const [forms, setForms] = useState<ConsentForm[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [hasSig, setHasSig] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [justSigned, setJustSigned] = useState(false)

  useEffect(() => {
    // Patient may be stored as JSON object or plain ID string
    const raw = sessionStorage.getItem('kiosk_patient') || sessionStorage.getItem('kiosk_patient_id') || ''
    let id = raw
    if (raw.startsWith('{')) {
      try { id = JSON.parse(raw).id || '' } catch { id = '' }
    }
    if (!id) {
      router.replace('/kiosk')
      return
    }
    setPatientId(id)

    fetch(`/api/consent/check?patientId=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then((data: CheckResponse) => {
        if (data.allSigned) {
          router.replace('/kiosk/done')
          return
        }
        // Filter to unsigned forms only (API returns signed: boolean per form)
        const unsigned = data.forms.filter((f: { signed: boolean }) => !f.signed)
        setForms(unsigned)
        setLoading(false)
      })
      .catch(() => {
        setError('Unable to load consent forms. Please ask staff for assistance.')
        setLoading(false)
      })
  }, [router])

  // Draw watermark when form changes
  useEffect(() => {
    if (!loading && forms.length > 0) {
      drawWatermark()
    }
  }, [loading, currentIndex, forms.length])

  function drawWatermark() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = '18px sans-serif'
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Sign here', canvas.width / 2, canvas.height / 2)
  }

  function startSign(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    setSigning(true)
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function drawSign(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!signing) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0055A5'
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSig(true)
  }

  function stopSign() {
    setSigning(false)
  }

  function clearSig() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSig(false)
    drawWatermark()
  }

  function getSignatureBase64(): string {
    return canvasRef.current!.toDataURL('image/png')
  }

  async function handleSubmit() {
    if (!patientId || !hasSig || !agreed) return
    const form = forms[currentIndex]
    setSubmitting(true)

    try {
      const signature = getSignatureBase64()
      const res = await fetch('/api/consent/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, formId: form.id, signature }),
      })
      if (!res.ok) throw new Error('Sign failed')

      setJustSigned(true)
      setTimeout(() => {
        setJustSigned(false)
        setAgreed(false)
        setHasSig(false)
        setSigning(false)

        if (currentIndex + 1 >= forms.length) {
          router.replace('/kiosk/done')
        } else {
          setCurrentIndex(i => i + 1)
          setTimeout(drawWatermark, 50)
        }
      }, 1200)
    } catch {
      setError('Failed to save signature. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ fontSize: 22, color: '#555', textAlign: 'center' }}>Loading consent forms…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ fontSize: 20, color: '#c00', textAlign: 'center' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (forms.length === 0) {
    return null
  }

  const form = forms[currentIndex]
  const totalForms = forms.length
  const canSign = hasSig && agreed && !submitting && !justSigned

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Progress */}
        <p style={styles.progress}>Form {currentIndex + 1} of {totalForms}</p>

        {/* Title */}
        <h1 style={styles.title}>{form.title}</h1>

        {/* Consent text */}
        <div
          style={styles.consentBox}
          dangerouslySetInnerHTML={{ __html: form.template }}
        />

        {/* Signature pad */}
        <div style={styles.sigSection}>
          <p style={styles.sigLabel}>Please sign below:</p>
          <div style={styles.canvasWrapper}>
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              style={styles.canvas}
              onMouseDown={startSign}
              onMouseMove={drawSign}
              onMouseUp={stopSign}
              onMouseLeave={stopSign}
              onTouchStart={startSign}
              onTouchMove={drawSign}
              onTouchEnd={stopSign}
            />
          </div>
          <button onClick={clearSig} style={styles.clearBtn}>Clear</button>
        </div>

        {/* Agree checkbox */}
        <label style={styles.checkLabel}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={styles.checkbox}
          />
          <span>I have read and agree to the above</span>
        </label>

        {/* Sign button or success */}
        {justSigned ? (
          <div style={styles.successBanner}>✅ Signed!</div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canSign}
            style={{ ...styles.signBtn, ...(canSign ? {} : styles.signBtnDisabled) }}
          >
            {submitting ? 'Saving…' : 'Sign & Continue'}
          </button>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f0f4f8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: '40px 36px',
    maxWidth: 700,
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
  },
  progress: {
    fontSize: 16,
    color: '#888',
    marginBottom: 8,
    fontWeight: 500,
    textAlign: 'center',
  },
  title: {
    fontSize: 30,
    color: '#0055A5',
    fontWeight: 700,
    marginBottom: 20,
    textAlign: 'center',
  },
  consentBox: {
    maxHeight: 300,
    overflowY: 'auto',
    border: '1px solid #d0d7e0',
    borderRadius: 8,
    padding: '16px 18px',
    fontSize: 16,
    lineHeight: 1.7,
    color: '#333',
    backgroundColor: '#fafbfc',
    marginBottom: 24,
  },
  sigSection: {
    marginBottom: 20,
  },
  sigLabel: {
    fontSize: 17,
    fontWeight: 600,
    color: '#333',
    marginBottom: 8,
  },
  canvasWrapper: {
    display: 'inline-block',
    border: '2px solid #0055A5',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    touchAction: 'none',
    width: '100%',
    maxWidth: 400,
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: 150,
    cursor: 'crosshair',
    touchAction: 'none',
  },
  clearBtn: {
    marginTop: 8,
    padding: '8px 20px',
    fontSize: 15,
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: 8,
    cursor: 'pointer',
    color: '#444',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 18,
    color: '#333',
    cursor: 'pointer',
    marginBottom: 24,
    userSelect: 'none',
  },
  checkbox: {
    width: 26,
    height: 26,
    cursor: 'pointer',
    accentColor: '#0055A5',
    flexShrink: 0,
  },
  signBtn: {
    width: '100%',
    padding: '18px 0',
    fontSize: 22,
    fontWeight: 700,
    backgroundColor: '#0055A5',
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  signBtnDisabled: {
    backgroundColor: '#b0bec5',
    cursor: 'not-allowed',
  },
  successBanner: {
    textAlign: 'center',
    fontSize: 30,
    fontWeight: 700,
    color: '#2e7d32',
    padding: '18px 0',
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
  },
}
