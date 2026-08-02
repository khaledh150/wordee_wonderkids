import { Component } from 'react'
import { reportError } from '../utils/errorReporter'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    reportError(error, `ErrorBoundary: ${info?.componentStack?.split('\n')[1]?.trim() || 'unknown'}`)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif', background: '#FFF5F0' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>😿</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3D2C4E', marginBottom: '0.5rem' }}>Oops! Something went wrong</h1>
          <p style={{ color: '#888', marginBottom: '1.5rem', maxWidth: '20rem' }}>Don't worry, just tap the button below to try again.</p>
          <button
            onClick={this.handleReload}
            className="animate-pulse-glow"
            style={{ background: 'linear-gradient(135deg, #EC4899, #8B5CF6)', color: '#fff', fontWeight: 700, padding: '0.85rem 2.5rem', borderRadius: '9999px', fontSize: '1.1rem', border: 'none', cursor: 'pointer', animation: 'error-btn-pulse 1.5s ease-in-out infinite', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)' }}
          >
            Reload App
          </button>
          <style>{`
            @keyframes error-btn-pulse {
              0%, 100% { transform: scale(1); box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4); }
              50% { transform: scale(1.08); box-shadow: 0 6px 25px rgba(139, 92, 246, 0.6); }
            }
          `}</style>
        </div>
      )
    }
    return this.props.children
  }
}
