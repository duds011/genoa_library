'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Eye, EyeOff } from 'lucide-react'
import { createStudent } from '@/app/actions/students'

const LANGUAGES = ['Japanese', 'Spanish', 'French', 'Portuguese', 'Italian', 'German', 'Korean', 'Mandarin', 'Other']
const LEVELS = ['Beginner', 'Elementary', 'Pre-Intermediate', 'Intermediate', 'Upper-Intermediate', 'Advanced']

export default function AddStudentForm({ teacherId }: { teacherId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    language: 'Japanese',
    level: 'Beginner',
    password: '',
  })

  void teacherId // teacher_id resolved server-side from session

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setCreatedCreds(null)

    const result = await createStudent({
      full_name: form.full_name,
      email: form.email,
      password: form.password,
      language: form.language,
      level: form.level,
    })

    if (!result.success) {
      setError(result.error || 'Failed to create student')
      setLoading(false)
      return
    }

    // Show credentials so teacher can share them
    setCreatedCreds({ email: form.email, password: form.password })
    setForm({ full_name: '', email: '', language: 'Japanese', level: 'Beginner', password: '' })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <UserPlus className="w-4 h-4 text-brand-600" />
        <h2 className="section-title">Add New Student</h2>
      </div>

      {createdCreds ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
            <p className="font-semibold mb-3">✅ Student account created!</p>
            <p className="mb-1">Share these login credentials with your student:</p>
            <div className="bg-white rounded-lg p-3 mt-2 space-y-1 font-mono text-xs border border-green-100">
              <p><span className="text-muted">Email:</span> {createdCreds.email}</p>
              <p><span className="text-muted">Password:</span> {createdCreds.password}</p>
            </div>
            <p className="mt-2 text-xs text-green-600">They can log in at your portal immediately.</p>
          </div>
          <button
            className="btn-secondary w-full justify-center text-sm"
            onClick={() => setCreatedCreds(null)}
          >
            Add Another Student
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="form-label">Full Name</label>
            <input name="full_name" className="input" placeholder="James Cooker"
              value={form.full_name} onChange={handleChange} required />
          </div>
          <div>
            <label className="form-label">Email Address</label>
            <input name="email" type="email" className="input" placeholder="student@email.com"
              value={form.email} onChange={handleChange} required />
          </div>
          <div>
            <label className="form-label">Initial Password</label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="input pr-10"
                placeholder="Min 6 characters"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                onClick={() => setShowPassword(s => !s)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted mt-1">You&apos;ll see this once after creating the account — share it with the student</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Language</label>
              <select name="language" className="input" value={form.language} onChange={handleChange}>
                {LANGUAGES.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Level</label>
              <select name="level" className="input" value={form.level} onChange={handleChange}>
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>}

          <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Student Account'}
          </button>
        </form>
      )}
    </div>
  )
}
