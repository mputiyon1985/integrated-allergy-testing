'use client'
import React from 'react'

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#f8fafc' }}>
          <div style={{ textAlign:'center', padding:40, background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', maxWidth:480 }}>
            <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
            <h2 style={{ color:'#0f172a', fontSize:20, fontWeight:700, marginBottom:8 }}>Something went wrong</h2>
            <p style={{ color:'#64748b', fontSize:14, marginBottom:24 }}>An unexpected error occurred. Please refresh the page.</p>
            <button onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
              style={{ padding:'10px 24px', borderRadius:8, border:'none', background:'#0d9488', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14 }}>
              🔄 Refresh Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
