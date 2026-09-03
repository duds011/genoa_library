'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Sign-in, in the shape of Lesson Studio's join page: one card rising out of
 * a soft brand bloom, each line a beat after the one above it.
 */
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
      setError('That email and password did not match. Check them and try again.')
      console.error(authError)
      setLoading(false)
      return
    }

    if (data.user) {
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
    <div className="k-join-card k-join-in">
      <div className="k-join-mark k-join-step" style={{ animationDelay: '.05s' }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--forest)', lineHeight: 1 }}>G</span>
      </div>
      <p className="k-join-eyebrow k-join-step" style={{ animationDelay: '.12s' }}>GENOA Library</p>
      <h1 className="k-join-title sm k-join-step" style={{ animationDelay: '.18s' }}>Welcome back</h1>
      <p className="k-join-sub k-join-step" style={{ animationDelay: '.24s' }}>
        Your lessons, recaps and progress — sign in to pick up where you left off.
      </p>

      <form onSubmit={handleLogin}>
        <label className="k-join-field k-join-step" style={{ animationDelay: '.3s' }}>
          <span>Email</span>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="k-join-field k-join-step" style={{ animationDelay: '.36s' }}>
          <span>Password</span>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {error && <p className="k-join-error">{error}</p>}

        <button type="submit" className="k-join-btn k-join-step" style={{ animationDelay: '.42s' }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="k-join-fine k-join-step" style={{ animationDelay: '.5s' }}>
        Lost your password? Ask Noa to reset it for you.
      </p>
    </div>
  )
}
