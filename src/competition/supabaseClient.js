import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const msg = `Missing env vars — VITE_SUPABASE_URL=${supabaseUrl ? 'set' : 'MISSING'}, VITE_SUPABASE_ANON_KEY=${supabaseAnonKey ? 'set' : 'MISSING'}`
  console.error(msg)
  if (typeof document !== 'undefined') {
    document.title = 'ENV ERROR'
    const pre = document.createElement('pre')
    pre.style.cssText = 'color:red;padding:2em'
    pre.textContent = msg + '\n\nIf deployed, add these in Vercel → Settings → Environment Variables, then redeploy without cache.'
    document.body.appendChild(pre)
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: { persistSession: true },
    realtime: { params: { eventsPerSecond: 10 } },
  }
)

export const SUBJECTS = { ENGLISH: 'english', MATH: 'math' }
