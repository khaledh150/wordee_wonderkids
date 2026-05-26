import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
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
            style={{ background: 'linear-gradient(135deg, #EC4899, #8B5CF6)', color: '#fff', fontWeight: 600, padding: '0.75rem 2rem', borderRadius: '9999px', fontSize: '1rem', border: 'none', cursor: 'pointer' }}
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
