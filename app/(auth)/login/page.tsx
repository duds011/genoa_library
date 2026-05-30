'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Check role and redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profile?.role === 'teacher') {
        router.push('/teacher/dashboard')
      } else {
        router.push('/student/dashboard')
      }
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
          <span className="text-2xl">📚</span>
        </div>
        <h1 className="text-2xl font-bold text-ink">Teacher Portal</h1>
        <p className="text-sm text-muted mt-1">Sign in to your account</p>
      </div>

      <div className="card p-8">
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="form-label">Email address</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full py-3 text-base mt-1"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in…
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-muted mt-6">
        Powered by Language Teacher Portal
      </p>
    </div>
  )
}
