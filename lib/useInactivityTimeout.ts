'use client'
import { useEffect, useCallback, useRef } from 'react'

const IDLE_MS = 15 * 60 * 1000  // 15 minutes
const WARN_MS = 2 * 60 * 1000   // warn 2 min before

export function useInactivityTimeout(
  onWarn: () => void,
  onLogout: () => void,
  enabled = true
) {
  const warnTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const reset = useCallback(() => {
    clearTimeout(warnTimer.current)
    clearTimeout(logoutTimer.current)
    if (!enabled) return
    warnTimer.current  = setTimeout(onWarn, IDLE_MS - WARN_MS)
    logoutTimer.current = setTimeout(onLogout, IDLE_MS)
  }, [onWarn, onLogout, enabled])

  useEffect(() => {
    if (!enabled) return
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      clearTimeout(warnTimer.current)
      clearTimeout(logoutTimer.current)
    }
  }, [reset, enabled])
}
