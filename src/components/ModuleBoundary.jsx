import { Component } from 'react'

export default class ModuleBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children

    const { label } = this.props
    return (
      <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 400, width: '100%', borderRadius: 16, border: '2px solid #fca5a5', background: '#fef2f2', padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 36, marginBottom: 8 }}>⚠️</p>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: '#991b1b', marginBottom: 4 }}>
            {label || 'Module'} Error
          </h3>
          <p style={{ fontSize: 13, color: '#dc2626', marginBottom: 12 }}>
            This section hit an error. The rest of the app is fine.
          </p>
          <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#ef4444', background: '#fee2e2', borderRadius: 8, padding: 8, marginBottom: 16, wordBreak: 'break-all' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding: '8px 24px', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 10, border: 'none', cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }
}
