'use client'

import { useEffect, useState } from 'react'
import AddStudentForm from './AddStudentForm'

/**
 * "Add student" lives in the page band and opens the form in a dialog, the
 * way Lesson Studio does it — the directory is the page, the form is a step
 * away from it, not a permanent column beside it.
 */
export default function AddStudentModal({ teacherId }: { teacherId: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Add student</button>
      {open && (
        <div className="modal-scrim" onClick={() => setOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Add a student" onClick={(e) => e.stopPropagation()}>
            <div className="g-modal-head">
              <div>
                <h3>Add a student</h3>
                <p>Creates their login. You will see the password once — share it with them.</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="g-modal-body">
              <AddStudentForm teacherId={teacherId} bare />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
