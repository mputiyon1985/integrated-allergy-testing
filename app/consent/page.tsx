'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

const CONSENT_ITEMS = [
  'I hereby consent to allergy testing procedures performed by Integrated Allergy Testing staff.',
  'I understand that allergy testing involves exposure to allergens that may cause reactions.',
  'I have been informed of the risks and benefits of allergy testing.',
  'I authorize the release of my allergy test results to my referring physician.',
  'I understand that I may withdraw consent at any time by notifying the clinical staff.',
  'I confirm that all information I have provided is accurate to the best of my knowledge.',
]

export default function ConsentPage() {
  const searchParams = useSearchParams()
  const patientId = searchParams.get('patientId') || ''
  const formId = searchParams.get('formId') || ''

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [submittedPatientId, setSubmittedPatientId] = useState('')

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#0055A5'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Fill white background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    e.preventDefault()
    const { x, y } = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }, [])

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      e.preventDefault()
      const { x, y } = getPos(e, canvas)
      ctx.lineTo(x, y)
      ctx.stroke()
      setHasSignature(true)
    },
    [isDrawing]
  )

  const stopDraw = useCallback(() => setIsDrawing(false), [])

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const handleSubmit = async () => {
    if (!patientId) {
      setError('Missing patient ID. Please scan the QR code again.')
      return
    }
    if (!formId) {
      setError('Missing form ID. Please contact clinical staff.')
      return
    }
    if (!hasSignature) {
      setError('Please provide your signature before submitting.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const canvas = canvasRef.current
      const signatureBase64 = canvas ? canvas.toDataURL('image/png') : undefined

      const res = await fetch('/api/forms/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          formId,
          signedAt: new Date().toISOString(),
          signature: signatureBase64,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Submission failed')
      }

      setSubmittedPatientId(patientId)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePrintPDF = () => {
    window.open(`/api/forms/pdf?patientId=${encodeURIComponent(submittedPatientId)}&type=consent`, '_blank')
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-lg w-full text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: '#2EC4B6' }}
          >
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">Consent Recorded</h1>
          <p className="text-gray-600 text-lg mb-8">
            Thank you. Your consent has been saved. Please return this device to the front desk.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handlePrintPDF}
              className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-white font-semibold text-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#0055A5' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download / Print PDF
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl mb-4"
            style={{ backgroundColor: '#0055A5' }}
          >
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-white text-xl font-bold">Integrated Allergy Testing</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Patient Consent Form</h1>
          <p className="text-gray-500 text-lg">Please read carefully and sign below</p>
        </div>

        {/* Consent Card */}
        <div className="bg-white rounded-2xl shadow-md p-8 mb-6">
          <h2 className="text-2xl font-semibold text-gray-700 mb-6 flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: '#2EC4B6' }}
            >
              ✓
            </span>
            I understand and agree to the following:
          </h2>
          <ol className="space-y-4">
            {CONSENT_ITEMS.map((item, i) => (
              <li key={i} className="flex items-start gap-4">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: '#0055A5' }}
                >
                  {i + 1}
                </span>
                <p className="text-gray-700 text-lg leading-relaxed">{item}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Signature Card */}
        <div className="bg-white rounded-2xl shadow-md p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-700">Your Signature</h2>
            <button
              onClick={clearSignature}
              className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors"
            >
              Clear
            </button>
          </div>
          <p className="text-gray-500 mb-4 text-lg">Sign below using your finger or stylus</p>
          <div
            className="rounded-xl overflow-hidden border-2 transition-colors"
            style={{ borderColor: hasSignature ? '#2EC4B6' : '#e5e7eb' }}
          >
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full touch-none cursor-crosshair bg-white"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>
          {!hasSignature && (
            <p className="text-center text-gray-400 mt-2 text-sm">↑ Sign in the box above</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-lg">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !hasSignature}
          className="w-full py-5 rounded-2xl text-white text-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: hasSignature ? '#2EC4B6' : '#9ca3af',
          }}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Submitting...
            </span>
          ) : (
            '✓ I Agree & Sign'
          )}
        </button>

        <p className="text-center text-gray-400 mt-4 text-sm">
          By tapping the button above, you confirm you have read and agree to the consent above.
        </p>
      </div>
    </div>
  )
}
