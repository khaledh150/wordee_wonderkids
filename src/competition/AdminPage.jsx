import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'
import useVersionCheck from '../hooks/useVersionCheck'

export default function AdminPage() {
  const [session, setSession] = useState(undefined) // undefined = loading, null = not logged in

  useVersionCheck()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-lg text-gray-400">Loading...</div>
  }

  if (!session) {
    return <AdminLogin onLogin={() => {}} />
  }

  return <AdminDashboard />
}
