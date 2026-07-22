'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore } from 'lucide-react'
import { setStudentArchived } from '@/app/actions/students'

/**
 * Archiving is the safe way to retire a student — nothing is destroyed, so it
 * needs no scary confirmation the way deleting does. It's one click either way.
 */
export default function ArchiveStudentButton({
  studentId,
  studentName,
  archived,
}: {
  studentId: string
  studentName: string
  archived: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setError('')
    startTransition(async () => {
      const res = await setStudentArchived(studentId, !archived)
      if (res.success) router.refresh()
      else setError(res.error ?? 'Failed')
    })
  }

  return (
    <>
      <button
        onClick={toggle}
        disabled={isPending}
        className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
          archived
            ? 'text-brand-600 hover:bg-brand-50'
            : 'text-gray-300 hover:text-amber-600 hover:bg-amber-50'
        }`}
        title={archived ? `Reactivate ${studentName}` : `Archive ${studentName} — hides them from payments and notes, keeps all their history`}
      >
        {archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
      </button>
      {error && <span className="text-xs text-red-500 self-center">{error}</span>}
    </>
  )
}
