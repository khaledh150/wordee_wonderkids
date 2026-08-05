import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { APP_VERSION } from '../../App'

const CHECKS = [
  {
    id: 'version',
    label: 'App Version',
    run: async () => {
      const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
      const data = await res.json()
      const match = data.version === APP_VERSION
      return {
        status: match ? 'ok' : 'warn',
        detail: match
          ? `v${APP_VERSION} (synced)`
          : `Local: v${APP_VERSION}, Server: v${data.version} — reload needed`,
      }
    },
  },
  {
    id: 'supabase',
    label: 'Supabase Connection',
    run: async () => {
      const start = performance.now()
      const { error } = await supabase.from('competition_state').select('id').limit(1)
      const ms = Math.round(performance.now() - start)
      if (error) return { status: 'fail', detail: error.message }
      return {
        status: ms > 2000 ? 'warn' : 'ok',
        detail: `Connected (${ms}ms)${ms > 2000 ? ' — slow' : ''}`,
      }
    },
  },
  {
    id: 'sw',
    label: 'Service Worker',
    run: async () => {
      if (!('serviceWorker' in navigator)) return { status: 'warn', detail: 'Not supported in this browser' }
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) return { status: 'warn', detail: 'Not registered — first visit or unsupported context' }
      const state = reg.active ? 'active' : reg.waiting ? 'waiting' : reg.installing ? 'installing' : 'unknown'
      return { status: state === 'active' ? 'ok' : 'warn', detail: `Registered (${state})` }
    },
  },
  {
    id: 'caches',
    label: 'Cache Storage',
    run: async () => {
      if (!('caches' in window)) return { status: 'warn', detail: 'Cache API not available' }
      const keys = await caches.keys()
      let totalSize = 0
      let totalEntries = 0
      const breakdown = []
      for (const name of keys) {
        const cache = await caches.open(name)
        const entries = await cache.keys()
        totalEntries += entries.length
        const short = name.length > 30 ? name.slice(0, 27) + '...' : name
        breakdown.push(`${short}: ${entries.length} files`)
      }
      return {
        status: totalEntries > 0 ? 'ok' : 'warn',
        detail: `${keys.length} caches, ${totalEntries} total entries`,
        extra: breakdown,
      }
    },
  },
  {
    id: 'storage',
    label: 'Storage Usage',
    run: async () => {
      if (!navigator.storage?.estimate) return { status: 'info', detail: 'Storage API not available' }
      const { usage, quota } = await navigator.storage.estimate()
      const usedMB = (usage / (1024 * 1024)).toFixed(1)
      const quotaMB = (quota / (1024 * 1024)).toFixed(0)
      const pct = ((usage / quota) * 100).toFixed(1)
      return {
        status: pct > 80 ? 'warn' : 'ok',
        detail: `${usedMB} MB / ${quotaMB} MB (${pct}%)`,
      }
    },
  },
  {
    id: 'image',
    label: 'Image Loading',
    run: () => new Promise(resolve => {
      const img = new Image()
      const start = performance.now()
      img.onload = () => {
        const ms = Math.round(performance.now() - start)
        resolve({ status: 'ok', detail: `Loaded test image (${ms}ms)` })
      }
      img.onerror = () => resolve({ status: 'fail', detail: 'Failed to load test image' })
      img.src = '/images/apple.webp?t=' + Date.now()
    }),
  },
  {
    id: 'audio',
    label: 'Audio Loading',
    run: () => new Promise(resolve => {
      const audio = new Audio()
      const start = performance.now()
      audio.oncanplaythrough = () => {
        const ms = Math.round(performance.now() - start)
        resolve({ status: 'ok', detail: `Audio ready (${ms}ms)` })
      }
      audio.onerror = () => resolve({ status: 'fail', detail: 'Failed to load test audio' })
      audio.src = '/audio/sfx/correct.wav?t=' + Date.now()
    }),
  },
  {
    id: 'memory',
    label: 'Memory Usage',
    run: async () => {
      if (!performance.memory) return { status: 'info', detail: 'Memory API not available (non-Chrome)' }
      const used = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)
      const total = (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(0)
      const pct = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1)
      return {
        status: pct > 80 ? 'warn' : 'ok',
        detail: `${used} MB / ${total} MB (${pct}%)`,
      }
    },
  },
  {
    id: 'sessions',
    label: 'Active Competition',
    run: async () => {
      const { data } = await supabase.from('competition_state').select('*')
      if (!data) return { status: 'fail', detail: 'Cannot read competition state' }
      const active = data.filter(s => s.is_unlocked)
      const running = data.filter(s => s.started_at)
      if (running.length > 0) {
        return { status: 'ok', detail: `${running.length} subject(s) running`, extra: running.map(s => `${s.id}: started ${new Date(s.started_at).toLocaleTimeString()}`) }
      }
      if (active.length > 0) {
        return { status: 'ok', detail: `${active.length} lobby open` }
      }
      return { status: 'info', detail: 'No active competition' }
    },
  },
  {
    id: 'participants',
    label: 'Registered Students',
    run: async () => {
      const { data } = await supabase.from('competition_state').select('competition_id').limit(1).single()
      if (!data) return { status: 'warn', detail: 'No competition state' }
      const { count: total } = await supabase.from('competition_sessions').select('*', { count: 'exact', head: true }).eq('competition_id', data.competition_id)
      const { count: ready } = await supabase.from('competition_sessions').select('*', { count: 'exact', head: true }).eq('competition_id', data.competition_id).eq('ready', true)
      const { count: completed } = await supabase.from('competition_sessions').select('*', { count: 'exact', head: true }).eq('competition_id', data.competition_id).eq('status', 'completed')
      return {
        status: 'ok',
        detail: `${total} registered, ${ready} ready, ${completed} completed`,
      }
    },
  },
  {
    id: 'join_fn',
    label: 'Join Function',
    run: async () => {
      const base = import.meta.env.VITE_SUPABASE_URL
      if (!base) return { status: 'fail', detail: 'VITE_SUPABASE_URL not set' }
      const start = performance.now()
      const res = await fetch(`${base}/functions/v1/join`, { method: 'OPTIONS' })
      const ms = Math.round(performance.now() - start)
      if (res.ok || res.status === 204) {
        return { status: 'ok', detail: `Reachable (${ms}ms)` }
      }
      return { status: 'warn', detail: `Status ${res.status} (${ms}ms)` }
    },
  },
  {
    id: 'device_locks',
    label: 'Device Locks',
    run: async () => {
      const { data: stateRows } = await supabase.from('competition_state').select('competition_id').limit(1).single()
      if (!stateRows) return { status: 'info', detail: 'No competition state' }
      const compId = stateRows.competition_id
      const { data: locked } = await supabase
        .from('competition_sessions')
        .select('participant_code, status, device_id, last_seen_at')
        .eq('competition_id', compId)
        .not('device_id', 'is', null)
      if (!locked || locked.length === 0) {
        return { status: 'ok', detail: 'No active device locks' }
      }
      const now = Date.now()
      const stale = locked.filter(s => {
        if (!s.last_seen_at) return true
        return (now - new Date(s.last_seen_at).getTime()) > 300000
      })
      const extra = locked.map(s => {
        const ago = s.last_seen_at ? Math.round((now - new Date(s.last_seen_at).getTime()) / 1000) : '?'
        const staleTag = typeof ago === 'number' && ago > 300 ? ' ⚠ STALE' : ''
        return `${s.participant_code} (${s.status}) — last seen ${ago}s ago${staleTag}`
      })
      if (stale.length > 0) {
        return {
          status: 'warn',
          detail: `${locked.length} locked, ${stale.length} stale (>5min) — may auto-release on next join`,
          extra,
        }
      }
      return {
        status: 'ok',
        detail: `${locked.length} active device lock(s)`,
        extra,
      }
    },
  },
  {
    id: 'answerkeys',
    label: 'Answer Keys',
    run: async () => {
      const { data: stateRows } = await supabase.from('competition_state').select('id, competition_id').limit(2)
      if (!stateRows?.length) return { status: 'warn', detail: 'No competition state found' }
      const compId = stateRows[0].competition_id
      const EXPECTED = {
        english: { 1: 174, 2: 174, 3: 198, 4: 302 },
        math: { 1: 200, 2: 200, 3: 200, 4: 200, 5: 200, 6: 200, 7: 200, 8: 200 },
      }
      const extra = []
      let allOk = true
      for (const sub of ['english', 'math']) {
        const exp = EXPECTED[sub]
        const levels = Object.keys(exp).map(Number)
        const expectedTotal = Object.values(exp).reduce((a, b) => a + b, 0)
        let source = compId
        // Count per level using head:true to bypass PostgREST row limit
        let levelCounts = await Promise.all(levels.map(lvl =>
          supabase.from('answer_keys').select('*', { count: 'exact', head: true })
            .eq('competition_id', compId).eq('subject', sub).eq('level', lvl)
            .then(({ count }) => ({ lvl, count: count || 0 }))
        ))
        let total = levelCounts.reduce((s, c) => s + c.count, 0)
        if (total === 0) {
          source = 'default'
          levelCounts = await Promise.all(levels.map(lvl =>
            supabase.from('answer_keys').select('*', { count: 'exact', head: true })
              .eq('competition_id', 'default').eq('subject', sub).eq('level', lvl)
              .then(({ count }) => ({ lvl, count: count || 0 }))
          ))
          total = levelCounts.reduce((s, c) => s + c.count, 0)
        }
        const missing = []
        for (const { lvl, count } of levelCounts) {
          if (count < exp[lvl]) missing.push(`L${lvl}: ${count}/${exp[lvl]}`)
        }
        if (missing.length > 0) {
          allOk = false
          extra.push(`${sub} (${source}): ${total}/${expectedTotal} — MISSING: ${missing.join(', ')}`)
        } else {
          extra.push(`${sub} (${source}): ${total}/${expectedTotal} ✓`)
        }
      }
      return {
        status: allOk ? 'ok' : 'fail',
        detail: allOk ? `All answer keys present for ${compId}` : `Missing answer keys — students will get errors!`,
        extra,
      }
    },
  },
  {
    id: 'network',
    label: 'Network Speed',
    run: async () => {
      const extra = []
      const conn = navigator.connection
      if (conn) {
        extra.push(`Browser estimate: ${conn.effectiveType} (${conn.downlink} Mbps, RTT ${conn.rtt}ms)`)
      }
      // Real download speed test — fetch a known asset with cache-busting and measure throughput
      const testUrls = [
        { url: '/images/apple.webp', label: 'Image (Vercel CDN)' },
        { url: '/audio/sfx/correct.wav', label: 'Audio (Vercel CDN)' },
      ]
      let totalBytes = 0
      let totalMs = 0
      for (const t of testUrls) {
        try {
          const start = performance.now()
          const res = await fetch(t.url + '?speedtest=' + Date.now(), { cache: 'no-store' })
          const blob = await res.blob()
          const elapsed = performance.now() - start
          totalBytes += blob.size
          totalMs += elapsed
          const kbps = ((blob.size * 8) / (elapsed / 1000) / 1000).toFixed(0)
          extra.push(`${t.label}: ${(blob.size / 1024).toFixed(1)} KB in ${Math.round(elapsed)}ms (${kbps} kbps)`)
        } catch {
          extra.push(`${t.label}: FAILED`)
        }
      }
      // Supabase latency test (DB round-trip)
      try {
        const start = performance.now()
        await supabase.from('competition_state').select('id').limit(1)
        const dbMs = Math.round(performance.now() - start)
        extra.push(`Supabase DB round-trip: ${dbMs}ms`)
      } catch {
        extra.push('Supabase DB round-trip: FAILED')
      }
      if (totalBytes > 0 && totalMs > 0) {
        const mbps = ((totalBytes * 8) / (totalMs / 1000) / 1_000_000).toFixed(2)
        const status = parseFloat(mbps) < 1 ? 'warn' : 'ok'
        return { status, detail: `Download: ${mbps} Mbps (${(totalBytes / 1024).toFixed(0)} KB in ${Math.round(totalMs)}ms)`, extra }
      }
      return { status: 'warn', detail: 'Could not measure download speed', extra }
    },
  },
  {
    id: 'browser',
    label: 'Browser Info',
    run: async () => {
      const ua = navigator.userAgent
      let browser = 'Unknown'
      if (ua.includes('Chrome/')) browser = 'Chrome ' + ua.match(/Chrome\/(\d+)/)?.[1]
      else if (ua.includes('Firefox/')) browser = 'Firefox ' + ua.match(/Firefox\/(\d+)/)?.[1]
      else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari ' + ua.match(/Version\/(\d+)/)?.[1]
      else if (ua.includes('Edg/')) browser = 'Edge ' + ua.match(/Edg\/(\d+)/)?.[1]
      const mobile = /Mobile|Android|iPhone/.test(ua)
      return {
        status: 'info',
        detail: `${browser} (${mobile ? 'Mobile' : 'Desktop'})`,
      }
    },
  },
]

const STATUS_STYLES = {
  ok: { bg: '#dcfce7', border: '#86efac', text: '#166534', icon: '✓' },
  warn: { bg: '#fef9c3', border: '#fde047', text: '#854d0e', icon: '⚠' },
  fail: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: '✗' },
  info: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', icon: 'ℹ' },
  pending: { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280', icon: '…' },
}

export default function DiagnosticsPanel({ isDark, onClose }) {
  const [results, setResults] = useState(null)
  const [running, setRunning] = useState(false)

  async function runAudit() {
    setRunning(true)
    const out = {}
    for (const check of CHECKS) {
      out[check.id] = { status: 'pending', detail: 'Running...' }
    }
    setResults({ ...out })

    for (const check of CHECKS) {
      try {
        const r = await Promise.race([
          check.run(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000)),
        ])
        out[check.id] = r
      } catch (err) {
        out[check.id] = { status: 'fail', detail: err.message }
      }
      setResults({ ...out })
    }
    setRunning(false)
  }

  const summary = results
    ? {
        total: CHECKS.length,
        ok: Object.values(results).filter(r => r.status === 'ok').length,
        warn: Object.values(results).filter(r => r.status === 'warn').length,
        fail: Object.values(results).filter(r => r.status === 'fail').length,
      }
    : null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: 16 }}>
      <div style={{
        maxWidth: 560, width: '100%', maxHeight: '85vh', overflow: 'auto',
        borderRadius: 20, padding: 24,
        background: isDark ? '#111827' : '#fff',
        color: isDark ? '#f9fafb' : '#111827',
        border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
        boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>App Health Audit</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: isDark ? '#9ca3af' : '#6b7280' }}>×</button>
        </div>

        {!results && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 16 }}>
              Run a full diagnostic to check all app systems.
            </p>
            <button
              onClick={runAudit}
              style={{ padding: '12px 32px', background: '#3b82f6', color: '#fff', fontWeight: 800, fontSize: 14, borderRadius: 12, border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 }}
            >
              Run Audit
            </button>
          </div>
        )}

        {results && (
          <>
            {summary && !running && (
              <div style={{
                display: 'flex', gap: 12, marginBottom: 16, padding: 12, borderRadius: 12,
                background: summary.fail > 0 ? '#fef2f2' : summary.warn > 0 ? '#fef9c3' : '#dcfce7',
                border: `1px solid ${summary.fail > 0 ? '#fca5a5' : summary.warn > 0 ? '#fde047' : '#86efac'}`,
              }}>
                <span style={{ fontSize: 28 }}>{summary.fail > 0 ? '🔴' : summary.warn > 0 ? '🟡' : '🟢'}</span>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 14, color: '#111', margin: 0 }}>
                    {summary.fail > 0 ? 'Issues Found' : summary.warn > 0 ? 'Some Warnings' : 'All Systems OK'}
                  </p>
                  <p style={{ fontSize: 12, color: '#555', margin: 0 }}>
                    {summary.ok} passed, {summary.warn} warnings, {summary.fail} failed
                  </p>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {CHECKS.map(check => {
                const r = results[check.id] || { status: 'pending', detail: '' }
                const s = STATUS_STYLES[r.status] || STATUS_STYLES.pending
                return (
                  <div key={check.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10,
                    background: isDark ? '#1f2937' : s.bg, border: `1px solid ${isDark ? '#374151' : s.border}`,
                  }}>
                    <span style={{ fontWeight: 900, fontSize: 14, color: s.text, minWidth: 18, textAlign: 'center' }}>
                      {r.status === 'pending' ? '⏳' : s.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, margin: 0, color: isDark ? '#f9fafb' : '#111' }}>
                        {check.label}
                      </p>
                      <p style={{ fontSize: 12, margin: 0, color: isDark ? '#9ca3af' : '#555', wordBreak: 'break-word' }}>
                        {r.detail}
                      </p>
                      {r.extra?.map((line, i) => (
                        <p key={i} style={{ fontSize: 11, margin: '2px 0 0', color: isDark ? '#6b7280' : '#888', fontFamily: 'monospace' }}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
              <button
                onClick={runAudit}
                disabled={running}
                style={{ padding: '10px 24px', background: running ? '#9ca3af' : '#3b82f6', color: '#fff', fontWeight: 800, fontSize: 12, borderRadius: 10, border: 'none', cursor: running ? 'default' : 'pointer', textTransform: 'uppercase', letterSpacing: 1 }}
              >
                {running ? 'Running...' : 'Re-run Audit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
