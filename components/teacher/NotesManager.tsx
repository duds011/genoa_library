'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, X, Check, Loader2, Trash2, Pin, PinOff, StickyNote, ChevronLeft, ChevronRight, Pencil, Archive } from 'lucide-react'
import { addStudentNote, updateStudentNote, toggleNotePin, deleteStudentNote } from '@/app/actions/notes'
import { EarningsPayment, formatHours, monthEarnings, LESSON_MINUTES } from '@/lib/earnings'
import { formatMoney } from '@/lib/currency'

export interface StudentOption {
  id: string
  fullName: string
  archived?: boolean
}

export interface ManagedNote {
  id: string
  studentId: string
  studentName: string
  content: string
  pinned: boolean
  note_date: string   // YYYY-MM-DD
  created_at: string
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoFor(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function fmtFullDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function NotesManager({
  students, notes, payments = [], currency = 'EUR',
}: {
  students: StudentOption[]
  notes: ManagedNote[]
  payments?: EarningsPayment[]
  currency?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth()) // 0-based

  // Add / edit modal
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<ManagedNote | null>(null)
  const [studentId, setStudentId] = useState('')
  const [content, setContent] = useState('')
  const [noteDate, setNoteDate] = useState(todayIso())

  // Day-cell popup (when a cell already has notes)
  const [dayCell, setDayCell] = useState<{ studentId: string; name: string; date: string } | null>(null)

  // ── Index notes by student + date ──────────────────────────────────────────
  const byCell = new Map<string, ManagedNote[]>()
  for (const n of notes) {
    const key = `${n.studentId}|${n.note_date}`
    const arr = byCell.get(key) ?? []
    arr.push(n)
    byCell.set(key, arr)
  }

  const archivedCount = students.filter(s => s.archived).length
  const sortedStudents = [...students]
    .filter(s => showArchived || !s.archived)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  // Days in the viewed month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const iso = isoFor(viewYear, viewMonth, day)
    const dow = new Date(viewYear, viewMonth, day).getDay()
    return { day, iso, weekday: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dow], weekend: dow === 0 || dow === 6 }
  })
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const today = todayIso()

  // Total notes shown this month (for the header)
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const monthCount = notes.filter(n => n.note_date.startsWith(monthPrefix)).length

  // One note = one lesson taught. Notes for archived students still count —
  // she taught those lessons and was paid for them.
  const earnings = monthEarnings(monthPrefix, notes, payments)

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }
  function jumpToday() { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()) }

  // ── Modal helpers ──────────────────────────────────────────────────────────
  function openAdd(presetStudent?: string, presetDate?: string) {
    setStudentId(presetStudent ?? '')
    setContent('')
    setNoteDate(presetDate ?? today)
    setEditing(null)
    setError('')
    setDayCell(null)
    setMode('add')
  }
  function openEdit(n: ManagedNote) {
    setStudentId(n.studentId)
    setContent(n.content)
    setNoteDate(n.note_date)
    setEditing(n)
    setError('')
    setDayCell(null)
    setMode('edit')
  }
  function closeModal() { setMode(null); setEditing(null) }

  function handleCellClick(sid: string, name: string, date: string) {
    const cellNotes = byCell.get(`${sid}|${date}`) ?? []
    if (cellNotes.length === 0) openAdd(sid, date)
    else setDayCell({ studentId: sid, name, date })
  }

  function handleSubmit() {
    if (mode === 'add' && !studentId) { setError('Please select a student'); return }
    if (!content.trim()) { setError('Note cannot be empty'); return }
    startTransition(async () => {
      const res = editing
        ? await updateStudentNote(editing.id, editing.studentId, content, noteDate)
        : await addStudentNote(studentId, content, noteDate)
      if (res.success) { closeModal(); router.refresh() }
      else setError(res.error || 'Failed to save note')
    })
  }
  function handleTogglePin(n: ManagedNote) {
    startTransition(async () => { await toggleNotePin(n.id, n.studentId, !n.pinned); router.refresh() })
  }
  function handleDelete(n: ManagedNote) {
    if (!confirm('Delete this note?')) return
    startTransition(async () => { await deleteStudentNote(n.id, n.studentId); closeModal(); setDayCell(null); router.refresh() })
  }

  const dayCellNotes = dayCell ? (byCell.get(`${dayCell.studentId}|${dayCell.date}`) ?? []) : []

  return (
    <div className="space-y-5">
      {/* ── What the month was worth ──────────────────────────────────────────
          Each note is one 50-minute lesson, so the grid doubles as a timesheet.
          Revenue is what was actually paid in this month. */}
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="stat-card flex-1 min-w-[140px]">
          <span className="stat-label">Lessons in {monthLabel}</span>
          <span className="stat-value">{earnings.lessons}</span>
          <span className="text-[10px] text-muted mt-0.5">one note = one lesson</span>
        </div>
        <div className="stat-card flex-1 min-w-[140px]">
          <span className="stat-label">Hours taught</span>
          <span className="stat-value">{formatHours(earnings.hours)}</span>
          <span className="text-[10px] text-muted mt-0.5">{LESSON_MINUTES} min per lesson</span>
        </div>
        <div className="stat-card flex-1 min-w-[140px]">
          <span className="stat-label">Paid this month</span>
          <span className="stat-value" style={{ color: '#10b981' }}>{formatMoney(earnings.revenue, currency)}</span>
        </div>
        <div className="stat-card flex-1 min-w-[140px]">
          <span className="stat-label">Per hour</span>
          {earnings.perHour == null ? (
            <>
              <span className="stat-value text-gray-300">—</span>
              <span className="text-[10px] text-muted mt-0.5">no lessons logged yet</span>
            </>
          ) : (
            <>
              <span className="stat-value" style={{ color: '#4f46e5' }}>{formatMoney(earnings.perHour, currency)}</span>
              <span className="text-[10px] text-muted mt-0.5">
                {formatMoney(earnings.revenue, currency)} ÷ {formatHours(earnings.hours)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Prepaid packages make this lumpy: a 12-lesson payment lands in one
          month but is taught over the next few, so a single month's rate can
          look far too high or too low. Say so rather than let the number
          pass for a salary. */}
      {earnings.perHour != null && (
        <p className="text-[11px] text-muted -mt-2">
          Counts cash received in {monthLabel} against lessons taught in {monthLabel}. Prepaid packages
          are paid in one month and taught over the next few, so compare a few months rather than
          trusting one.
        </p>
      )}

      {/* Toolbar: month nav + add */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-muted hover:bg-gray-100 hover:text-ink transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-ink w-40 text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg text-muted hover:bg-gray-100 hover:text-ink transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button onClick={jumpToday} className="btn-ghost text-xs">Today</button>
        <span className="text-xs text-muted">{monthCount} note{monthCount === 1 ? '' : 's'} this month</span>
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived(v => !v)}
            className={`btn-ghost text-xs flex items-center gap-1.5 ${showArchived ? 'text-brand-600' : ''}`}
          >
            <Archive className="w-3.5 h-3.5" />
            {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
          </button>
        )}
        <button onClick={() => openAdd()} className="btn-primary text-xs flex items-center gap-1.5 ml-auto">
          <Plus className="w-3.5 h-3.5" /> Add Note
        </button>
      </div>

      {/* Excel-style grid */}
      {students.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="font-semibold text-ink mb-1">No students yet</p>
          <p className="text-sm text-muted">Add students first to start taking notes</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 px-2 sm:px-3 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-wide w-[112px] min-w-[112px] max-w-[112px] sm:w-auto sm:min-w-[140px] sm:max-w-none">
                    Student
                  </th>
                  {days.map(d => (
                    <th
                      key={d.iso}
                      className={`border-b border-gray-100 px-0 py-1.5 w-11 min-w-[44px] text-center font-semibold ${
                        d.iso === today ? 'bg-brand-50' : d.weekend ? 'bg-gray-50/60' : 'bg-white'
                      }`}
                    >
                      <div className={`text-sm leading-none ${d.iso === today ? 'text-brand-600' : 'text-ink'}`}>{d.day}</div>
                      <div className="text-[9px] text-muted mt-0.5">{d.weekday}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map(s => (
                  <tr key={s.id} className="group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-b border-r border-gray-200 px-2 sm:px-3 py-2 w-[112px] min-w-[112px] max-w-[112px] sm:w-auto sm:min-w-[140px] sm:max-w-none">
                      <Link
                        href={`/teacher/students/${s.id}`}
                        title={s.fullName}
                        className={`font-medium hover:text-brand-600 transition-colors block truncate sm:whitespace-nowrap ${s.archived ? 'text-muted italic' : 'text-ink'}`}
                      >
                        {s.fullName}{s.archived && <span className="ml-1 text-[10px] not-italic">archived</span>}
                      </Link>
                    </td>
                    {days.map(d => {
                      const cellNotes = byCell.get(`${s.id}|${d.iso}`) ?? []
                      const has = cellNotes.length > 0
                      const pinned = cellNotes.some(n => n.pinned)
                      return (
                        <td
                          key={d.iso}
                          className={`border-b border-r border-gray-100 p-0 w-11 min-w-[44px] h-10 ${d.weekend && !has ? 'bg-gray-50/40' : ''}`}
                        >
                          <button
                            onClick={() => handleCellClick(s.id, s.fullName, d.iso)}
                            title={has ? cellNotes[0].content : 'Add note'}
                            className={`w-full h-10 flex items-center justify-center transition-colors ${
                              has
                                ? pinned ? 'bg-amber-100 hover:bg-amber-200' : 'bg-brand-100 hover:bg-brand-200'
                                : 'hover:bg-brand-50'
                            }`}
                          >
                            {has ? (
                              cellNotes.length > 1
                                ? <span className={`text-[11px] font-bold ${pinned ? 'text-amber-700' : 'text-brand-700'}`}>{cellNotes.length}</span>
                                : <span className={`w-2 h-2 rounded-full ${pinned ? 'bg-amber-500' : 'bg-brand-500'}`} />
                            ) : (
                              <span className="opacity-0 group-hover:opacity-30 text-muted">+</span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted">
        Click any cell to add or read a note. <span className="inline-block w-2 h-2 rounded-full bg-brand-500 align-middle mx-1" /> has a note ·
        <span className="inline-block w-2 h-2 rounded-full bg-amber-500 align-middle mx-1" /> pinned · numbers show multiple notes that day.
      </p>

      {/* ── Day-cell popup (existing notes) ── */}
      {dayCell && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40" onClick={() => setDayCell(null)}>
          <div className="card w-full max-w-md p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-ink">{dayCell.name}</h3>
                <p className="text-xs text-muted">{fmtFullDate(dayCell.date)}</p>
              </div>
              <button onClick={() => setDayCell(null)} className="text-gray-400 hover:text-ink"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-2.5">
              {dayCellNotes.map(n => (
                <div key={n.id} className={`rounded-xl border px-3.5 py-3 ${n.pinned ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                  <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{n.content}</p>
                  <div className="flex items-center gap-1 mt-2 -mb-1">
                    <button onClick={() => openEdit(n)} className="p-1.5 rounded-lg text-gray-400 hover:text-ink hover:bg-white" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleTogglePin(n)} disabled={pending} className={`p-1.5 rounded-lg hover:bg-white ${n.pinned ? 'text-amber-600' : 'text-gray-400 hover:text-ink'}`} title={n.pinned ? 'Unpin' : 'Pin'}>
                      {n.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleDelete(n)} disabled={pending} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => openAdd(dayCell.studentId, dayCell.date)} className="btn-secondary text-xs w-full justify-center mt-4">
              <Plus className="w-3.5 h-3.5" /> Add another note this day
            </button>
          </div>
        </div>
      )}

      {/* ── Add / edit modal ── */}
      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeModal}>
          <div className="card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-brand-600" />
                <h3 className="font-bold text-ink">{mode === 'add' ? 'New Note' : 'Edit Note'}</h3>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-ink"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">Student</label>
                  {mode === 'add' ? (
                    <select value={studentId} onChange={e => setStudentId(e.target.value)} className="input w-full text-sm mt-1">
                      <option value="">Select…</option>
                      {sortedStudents.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm font-semibold text-ink mt-2 truncate">{editing?.studentName}</p>
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">Date</label>
                  <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)} className="input w-full text-sm mt-1" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">Note</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={5}
                  autoFocus
                  placeholder="e.g. Left off at chapter 5. Struggling with て-form. Next time: travel vocab + casual past tense."
                  className="textarea w-full text-sm mt-1"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex items-center gap-2 pt-2">
                {mode === 'edit' && editing && (
                  <>
                    <button onClick={() => handleDelete(editing)} disabled={pending} className="btn-ghost text-xs text-red-500 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                    <button onClick={() => handleTogglePin(editing)} disabled={pending} className={`btn-ghost text-xs ${editing.pinned ? 'text-amber-600' : ''}`}>
                      {editing.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      {editing.pinned ? 'Unpin' : 'Pin'}
                    </button>
                  </>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={closeModal} className="btn-ghost text-xs" disabled={pending}>Cancel</button>
                  <button onClick={handleSubmit} className="btn-primary text-xs" disabled={pending}>
                    {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {mode === 'add' ? 'Add Note' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
