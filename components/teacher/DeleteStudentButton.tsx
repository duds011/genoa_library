'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, X } from 'lucide-react'
import { deleteStudent } from '@/app/actions/students'

export default function DeleteStudentButton({
  studentId,
  studentName,
}: {
  studentId: string
  studentName: string
}) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    setError('')
    startTransition(async () => {
      const res = await deleteStudent(studentId)
      if (res.success) {
        router.refresh()
      } else {
        setError(res.error ?? 'Delete failed')
        setConfirm(false)
      }
    })
  }

  if (!confirm) {
    return (
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirm(true) }}
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        title="Delete student"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    )
  }

  return (
    <span
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
      className="inline-flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-1.5"
    >
      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
      <span className="text-xs text-red-700 font-medium">Delete {studentName}?</span>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs px-2 py-0.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button
        onClick={() => { setConfirm(false); setError('') }}
        disabled={isPending}
        className="text-gray-400 hover:text-gray-600"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  )
}
