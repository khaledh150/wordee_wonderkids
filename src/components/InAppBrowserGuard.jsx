import { useEffect, useState } from 'react'

export default function InAppBrowserGuard({ children }) {
  const [browserInfo, setBrowserInfo] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ''

    if (/Line\//i.test(ua)) {
      const url = new URL(window.location.href)
      if (!url.searchParams.has('openExternalBrowser')) {
        url.searchParams.set('openExternalBrowser', '1')
        window.location.href = url.toString()
        return
      }
    }

    const detections = [
      { pattern: /FBAN|FBAV/i, name: 'Facebook' },
      { pattern: /Instagram/i, name: 'Instagram' },
      { pattern: /TikTok/i, name: 'TikTok' },
      { pattern: /Twitter|TwitterAndroid/i, name: 'Twitter' },
      { pattern: /Line\//i, name: 'LINE' },
      { pattern: /MicroMessenger/i, name: 'WeChat' },
      { pattern: /Snapchat/i, name: 'Snapchat' },
    ]

    let detectedApp = null
    for (const d of detections) {
      if (d.pattern.test(ua)) { detectedApp = d.name; break }
    }

    if (!detectedApp && /Android/i.test(ua) && /\bwv\b/.test(ua)) {
      detectedApp = 'WebView'
    }

    if (detectedApp) {
      const isAndroid = /Android/i.test(ua)
      const isIOS = /iPhone|iPad|iPod/i.test(ua)
      setBrowserInfo({ app: detectedApp, isAndroid, isIOS })
    }
  }, [])

  const handleOpenChrome = () => {
    const { host, pathname, search, hash } = window.location
    window.location.href = `intent://${host}${pathname}${search}${hash}#Intent;scheme=https;package=com.android.chrome;end`
  }

  const handleCopyLink = async () => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('openExternalBrowser')
      await navigator.clipboard.writeText(url.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      const url = new URL(window.location.href)
      url.searchParams.delete('openExternalBrowser')
      input.value = url.toString()
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getMenuInstruction = (app, isIOS) => {
    if (app === 'Facebook') {
      return isIOS
        ? { en: 'Tap ⋯ at the bottom, then "Open in Safari"', th: 'กดปุ่ม ⋯ ด้านล่าง แล้วเลือก "เปิดใน Safari"' }
        : { en: 'Tap ⋮ at the top-right, then "Open in Chrome"', th: 'กดปุ่ม ⋮ มุมขวาบน แล้วเลือก "เปิดใน Chrome"' }
    }
    if (app === 'Instagram') {
      return isIOS
        ? { en: 'Tap ⋯ at the top-right, then "Open in Safari"', th: 'กดปุ่ม ⋯ มุมขวาบน แล้วเลือก "เปิดใน Safari"' }
        : { en: 'Tap ⋮ at the top-right, then "Open in Chrome"', th: 'กดปุ่ม ⋮ มุมขวาบน แล้วเลือก "เปิดใน Chrome"' }
    }
    if (app === 'LINE') {
      return isIOS
        ? { en: 'Tap the share icon at the bottom-right, then "Open in Safari"', th: 'กดไอคอนแชร์มุมขวาล่าง แล้วเลือก "เปิดใน Safari"' }
        : { en: 'Tap ⋮ at the top-right, then "Open in other browser"', th: 'กดปุ่ม ⋮ มุมขวาบน แล้วเลือก "เปิดในเบราว์เซอร์อื่น"' }
    }
    if (app === 'TikTok') {
      return isIOS
        ? { en: 'Tap ⋯ at the bottom-right, then "Open in Safari"', th: 'กดปุ่ม ⋯ มุมขวาล่าง แล้วเลือก "เปิดใน Safari"' }
        : { en: 'Tap ⋮ at the top-right, then "Open in browser"', th: 'กดปุ่ม ⋮ มุมขวาบน แล้วเลือก "เปิดในเบราว์เซอร์"' }
    }
    const browserName = isIOS ? 'Safari' : 'Chrome'
    return {
      en: `Tap the menu icon (⋮ or ⋯), then "Open in ${browserName}"`,
      th: `กดที่ไอคอนเมนู (⋮ หรือ ⋯) แล้วเลือก "เปิดใน ${browserName}"`,
    }
  }

  if (!browserInfo) return children

  const instruction = getMenuInstruction(browserInfo.app, browserInfo.isIOS)
  const browserName = browserInfo.isIOS ? 'Safari' : 'Chrome'
  const showBottomArrow = browserInfo.isIOS && (browserInfo.app === 'Facebook' || browserInfo.app === 'TikTok')

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'#fff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'1.5rem', textAlign:'center', fontFamily:'system-ui, sans-serif', color:'#1a1a2e' }}>
      {!showBottomArrow && (
        <div style={{ position:'absolute', top:'1rem', right:'1rem' }} className="animate-bounce">
          <svg style={{ width:48, height:48, color:'#4d79ff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 19L19 5M19 5H9M19 5v10" />
          </svg>
        </div>
      )}
      {showBottomArrow && (
        <div style={{ position:'absolute', bottom:'5rem', right:'1rem' }} className="animate-bounce">
          <svg style={{ width:48, height:48, color:'#4d79ff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5L19 19M19 19H9M19 19V9" />
          </svg>
        </div>
      )}

      <svg style={{ width:64, height:64, color:'#f59e0b', marginBottom:'1.5rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>

      <h1 style={{ fontSize:'1.25rem', fontWeight:700, marginBottom:'0.5rem' }}>Open in {browserName}</h1>
      <p style={{ fontSize:'1rem', color:'#555', marginBottom:'0.25rem', maxWidth:'20rem' }}>
        For the best experience, please open this link in {browserName}.
      </p>
      <p style={{ fontSize:'0.875rem', color:'#888', marginBottom:'1.5rem', maxWidth:'20rem' }}>{instruction.en}</p>

      <h2 style={{ fontSize:'1.125rem', fontWeight:700, marginBottom:'0.5rem' }}>โปรดเปิดใน {browserName}</h2>
      <p style={{ fontSize:'1rem', color:'#555', marginBottom:'0.25rem', maxWidth:'20rem' }}>
        เพื่อการใช้งานที่สมบูรณ์ โปรดเปิดลิงก์นี้ใน {browserName}
      </p>
      <p style={{ fontSize:'0.875rem', color:'#888', marginBottom:'2rem', maxWidth:'20rem' }}>{instruction.th}</p>

      {browserInfo.isAndroid && (
        <button
          onClick={handleOpenChrome}
          style={{ width:'100%', maxWidth:'20rem', background:'#4d79ff', color:'#fff', fontWeight:600, padding:'0.75rem 1.5rem', borderRadius:'0.75rem', fontSize:'1rem', border:'none', marginBottom:'0.75rem', cursor:'pointer' }}
        >
          Open in Chrome / เปิดใน Chrome
        </button>
      )}

      <button
        onClick={handleCopyLink}
        style={{ width:'100%', maxWidth:'20rem', background:'#f3f4f6', color:'#374151', fontWeight:600, padding:'0.75rem 1.5rem', borderRadius:'0.75rem', fontSize:'1rem', border:'none', cursor:'pointer' }}
      >
        {copied ? '✓ Copied! / คัดลอกแล้ว!' : 'Copy Link / คัดลอกลิงก์'}
      </button>
      <p style={{ fontSize:'0.75rem', color:'#aaa', marginTop:'0.5rem', maxWidth:'20rem' }}>
        Paste this link in {browserName} / วางลิงก์นี้ใน {browserName}
      </p>
    </div>
  )
}
