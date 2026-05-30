'use client'

import { useState, useTransition } from 'react'
import { Trash2, AlertTriangle, X } from 'lucide-react'
import { deleteLesson } from '@/app/actions/lessons'

interface Props {
  lessonId: string
  lessonLabel: string     // e.g. "Lesson 3 — James Coker"
  variant?: 'icon' | 'row' // icon = small icon button; row = text link style for table rows
}

export default function DeleteLessonButton({ lessonId, lessonLabel, variant = 'icon' }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteLesson(lessonId)
      if (!result.success) {
        setError(result.error ?? 'Delete failed')
        setConfirming(false)
      }
      // On success the page revalidates and the item disappears — no extra state needed
    })
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs text-red-600 font-medium flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Delete {lessonLabel}?
        </span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs px-2 py-0.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          onClick={() => { setConfirming(false); setError('') }}
          disabled={isPending}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </span>
    )
  }

  if (variant === 'row') {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
        title={`Delete ${lessonLabel}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    )
  }

  // icon variant — used in cards
  return (
    <button
      onClick={() => setConfirming(true)}
      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
      title={`Delete ${lessonLabel}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
