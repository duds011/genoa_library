'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, X, Check, Loader2, Trash2, CircleCheck, Wallet, Pencil, ChevronLeft, ChevronRight, ChevronRight as Chevron, Archive, ArrowDownNarrowWide } from 'lucide-react'
import { addPayment, updatePayment, deletePayment, markPaymentPaid, updateTeacherCurrency, setLessonsRemaining, PaymentInput } from '@/app/actions/payments'
import { formatMoney, currencySymbol, CURRENCIES } from '@/lib/currency'
import { formatJpy } from '@/lib/fx'

export interface StudentOption {
  id: string
  fullName: string
  lessonsRemaining?: number | null
  archived?: boolean
}

type SortMode = 'name' | 'lessons'

export interface ManagedPayment {
  id: string
  studentId: string
  studentName: string
  amount: number
  currency: string | null
  status: 'paid' | 'pending'
  description: string | null
  lessons_covered: number | null
  payment_date: string | null
  due_date: string | null
  method: string | null
  created_at: string
}

// Sentinels for non-student income rows.
const OTHER_ID = '__other__'
const TRIAL_ID = '__trial__'

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const isoFor = (y: number, m: number, day: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

// The date a payment occupies in the grid: paid → payment_date, pending → due_date, else created.
const displayDate = (p: ManagedPayment) =>
  (p.status === 'paid' ? p.payment_date : p.due_date) || p.created_at.slice(0, 10)

function fmtFullDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const emptyForm = () => ({
  amount: '', status: 'paid' as 'paid' | 'pending', description: '',
  lessons_covered: '', payment_date: todayIso(), due_date: '', method: '',
})

export default function PaymentsManager({
  students, payments, currency, jpyRate,
}: {
  students: StudentOption[]
  payments: ManagedPayment[]
  currency: string
  /** null when no live rate could be fetched — the JPY line is hidden, never guessed. */
  jpyRate?: { rate: number; asOf: string } | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<ManagedPayment | null>(null)
  const [studentId, setStudentId] = useState('')
  const [form, setForm] = useState(emptyForm())

  const [dayCell, setDayCell] = useState<{ studentId: string; name: string; date: string } | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [showArchived, setShowArchived] = useState(false)

  // Lessons-left balance per student + editor modal
  const lessonsLeftMap = new Map(students.map(s => [s.id, s.lessonsRemaining ?? null]))
  const [lessonsFor, setLessonsFor] = useState<{ id: string; name: string } | null>(null)
  const [lessonsDraft, setLessonsDraft] = useState('')

  function openLessons(id: string, name: string) {
    const cur = lessonsLeftMap.get(id)
    setLessonsDraft(cur != null ? String(cur) : '')
    setLessonsFor({ id, name })
  }
  function bumpLessons(delta: number) {
    const base = parseInt(lessonsDraft || '0', 10) || 0
    setLessonsDraft(String(base + delta))
  }
  function saveLessons() {
    if (!lessonsFor) return
    const trimmed = lessonsDraft.trim()
    const value = trimmed === '' ? null : parseInt(trimmed, 10)
    startTransition(async () => {
      await setLessonsRemaining(lessonsFor.id, Number.isNaN(value as number) ? null : value)
      setLessonsFor(null)
      router.refresh()
    })
  }

  // ── Index payments by student + display date ───────────────────────────────
  const byCell = new Map<string, ManagedPayment[]>()
  for (const p of payments) {
    const key = `${p.studentId}|${displayDate(p)}`
    const arr = byCell.get(key) ?? []
    arr.push(p)
    byCell.set(key, arr)
  }

  const byName = (a: StudentOption, b: StudentOption) => a.fullName.localeCompare(b.fullName)

  /**
   * Sorting by lessons left puts whoever is closest to running out at the top,
   * so the students who need a top-up conversation are the first thing she
   * sees. Students with no balance tracked sink to the bottom — an untracked
   * balance isn't urgent, it's just unknown.
   */
  function byLessonsLeft(a: StudentOption, b: StudentOption) {
    const av = a.lessonsRemaining
    const bv = b.lessonsRemaining
    if (av == null && bv == null) return byName(a, b)
    if (av == null) return 1
    if (bv == null) return -1
    if (av !== bv) return av - bv
    return byName(a, b)
  }

  const archivedCount = students.filter(s => s.archived).length
  const visibleStudents = [...students]
    .filter(s => showArchived || !s.archived)
    .sort(sortMode === 'lessons' ? byLessonsLeft : byName)

  // Grid rows: students in the chosen order, then catch-all Trials and Other income rows.
  const gridRows: StudentOption[] = [
    ...visibleStudents,
    { id: TRIAL_ID, fullName: 'Trials' },
    { id: OTHER_ID, fullName: 'Other' },
  ]
  const SPECIAL_ROWS: Record<string, { label: string; icon: string }> = {
    [TRIAL_ID]: { label: 'Trials', icon: '🎓' },
    [OTHER_ID]: { label: 'Other', icon: '✨' },
  }

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
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`

  // Sum of a row's payments shown in the current month (the frozen "Total" column)
  function rowTotal(id: string): number {
    return days.reduce((t, d) => t + (byCell.get(`${id}|${d.iso}`) ?? []).reduce((a, p) => a + p.amount, 0), 0)
  }

  // Drag-to-scroll for the grid (desktop): grab anywhere and pan horizontally.
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ down: false, startX: 0, left: 0, moved: false })
  function onGridDown(e: React.MouseEvent) {
    const el = scrollRef.current; if (!el) return
    drag.current = { down: true, startX: e.pageX, left: el.scrollLeft, moved: false }
  }
  function onGridMove(e: React.MouseEvent) {
    const el = scrollRef.current; const d = drag.current
    if (!el || !d.down) return
    const dx = e.pageX - d.startX
    if (Math.abs(dx) > 4) d.moved = true
    el.scrollLeft = d.left - dx
    e.preventDefault()
  }
  function onGridUp() { drag.current.down = false; setTimeout(() => { drag.current.moved = false }, 0) }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalReceived = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const totalOutstanding = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
  const viewedMonthReceived = payments
    .filter(p => p.status === 'paid' && p.payment_date && p.payment_date.startsWith(monthPrefix))
    .reduce((s, p) => s + p.amount, 0)

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) } else setViewMonth(viewMonth - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) } else setViewMonth(viewMonth + 1)
  }
  function jumpToday() { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()) }

  // ── Modal helpers ──────────────────────────────────────────────────────────
  function openAdd(presetStudent?: string, presetDate?: string) {
    setForm({ ...emptyForm(), payment_date: presetDate ?? todayIso(), due_date: presetDate ?? '' })
    setStudentId(presetStudent ?? '')
    setEditing(null); setError(''); setDayCell(null); setMode('add')
  }
  function openEdit(p: ManagedPayment) {
    setForm({
      amount: String(p.amount), status: p.status, description: p.description ?? '',
      lessons_covered: p.lessons_covered != null ? String(p.lessons_covered) : '',
      payment_date: p.payment_date ?? todayIso(), due_date: p.due_date ?? '', method: p.method ?? '',
    })
    setStudentId(p.studentId)
    setEditing(p); setError(''); setDayCell(null); setMode('edit')
  }
  function closeModal() { setMode(null); setEditing(null) }

  function handleCellClick(sid: string, name: string, date: string) {
    if (drag.current.moved) return  // was a drag-scroll, not a click
    const cell = byCell.get(`${sid}|${date}`) ?? []
    if (cell.length === 0) openAdd(sid, date)
    else setDayCell({ studentId: sid, name, date })
  }

  function handleSubmit() {
    if (mode === 'add' && !studentId) { setError('Please select a student'); return }
    const amount = parseFloat(form.amount)
    if (!(amount > 0)) { setError('Enter an amount greater than zero'); return }
    const input: PaymentInput = {
      amount, status: form.status, description: form.description,
      lessons_covered: form.lessons_covered ? parseInt(form.lessons_covered, 10) : null,
      payment_date: form.payment_date || null, due_date: form.due_date || null, method: form.method,
    }
    startTransition(async () => {
      const res = editing ? await updatePayment(editing.id, input) : await addPayment(studentId, input)
      if (res.success) { closeModal(); router.refresh() }
      else setError(res.error || 'Failed to save payment')
    })
  }
  function handleMarkPaid(id: string) {
    startTransition(async () => { await markPaymentPaid(id); closeModal(); setDayCell(null); router.refresh() })
  }
  function handleDelete(id: string) {
    if (!confirm('Delete this payment record?')) return
    startTransition(async () => { await deletePayment(id); closeModal(); setDayCell(null); router.refresh() })
  }

  const dayCellPayments = dayCell ? (byCell.get(`${dayCell.studentId}|${dayCell.date}`) ?? []) : []

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="stat-card flex-1 min-w-[150px]">
          <span className="stat-label">{monthLabel}</span>
          <span className="stat-value" style={{ color: '#10b981' }}>{formatMoney(viewedMonthReceived, currency)}</span>
          {/* The month's income in yen. The rate and its date are shown because a
              converted figure that hides its rate looks more precise than it is. */}
          {jpyRate && currency !== 'JPY' && (
            <span className="text-xs font-bold text-ink mt-0.5" title={`1 ${currency} = ${jpyRate.rate} JPY (${jpyRate.asOf})`}>
              ≈ {formatJpy(viewedMonthReceived * jpyRate.rate)}
              <span className="block text-[10px] font-normal text-muted">
                at {jpyRate.rate.toFixed(2)} ¥/{currencySymbol(currency)} · {jpyRate.asOf}
              </span>
            </span>
          )}
        </div>
        <div className="stat-card flex-1 min-w-[150px]">
          <span className="stat-label">Received all time</span>
          <span className="stat-value">{formatMoney(totalReceived, currency)}</span>
        </div>
        <div className="stat-card flex-1 min-w-[150px]">
          <span className="stat-label">Outstanding</span>
          <span className="stat-value" style={{ color: totalOutstanding > 0 ? '#f97316' : undefined }}>
            {formatMoney(totalOutstanding, currency)}
          </span>
        </div>
      </div>

      {/* Toolbar: month nav + add */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-muted hover:bg-gray-100 hover:text-ink transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="font-bold text-ink w-40 text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg text-muted hover:bg-gray-100 hover:text-ink transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <button onClick={jumpToday} className="btn-ghost text-xs">Today</button>

        {/* Sort — "lessons left" surfaces who needs a top-up conversation. */}
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <ArrowDownNarrowWide className="w-3.5 h-3.5" />
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            className="input text-[11px] py-1 w-auto"
            title="Row order"
          >
            <option value="name">Sort by name</option>
            <option value="lessons">Sort by lessons left</option>
          </select>
        </div>

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
          <Plus className="w-3.5 h-3.5" /> Add Payment
        </button>
      </div>

      {/* Excel-style grid */}
      {students.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">💸</p>
          <p className="font-semibold text-ink mb-1">No students yet</p>
          <p className="text-sm text-muted">Add students first to start tracking payments</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div
            ref={scrollRef}
            onMouseDown={onGridDown}
            onMouseMove={onGridMove}
            onMouseUp={onGridUp}
            onMouseLeave={onGridUp}
            className="overflow-x-auto cursor-grab active:cursor-grabbing select-none"
          >
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  {/* On a phone the three frozen columns left ~10px for the
                      actual days, so Lessons Left and Total only freeze from sm
                      up; on mobile the balance rides along inside the student
                      cell instead. */}
                  <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 px-2 sm:px-3 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-wide w-[124px] min-w-[124px] max-w-[124px] sm:w-[150px] sm:min-w-[150px] sm:max-w-[150px]">
                    Student
                  </th>
                  <th className="hidden sm:table-cell sm:sticky sm:left-[150px] z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-center text-[11px] font-semibold text-muted uppercase tracking-wide sm:w-[90px] sm:min-w-[90px] sm:max-w-[90px]">
                    Lessons Left
                  </th>
                  <th className="hidden sm:table-cell sm:sticky sm:left-[240px] z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-right text-[11px] font-semibold text-muted uppercase tracking-wide sm:w-[84px] sm:min-w-[84px]">
                    Total
                  </th>
                  {days.map(d => (
                    <th key={d.iso}
                      className={`border-b border-gray-100 px-0 py-1.5 w-[56px] min-w-[56px] sm:w-[68px] sm:min-w-[68px] text-center font-semibold ${
                        d.iso === today ? 'bg-brand-50' : d.weekend ? 'bg-gray-50/60' : 'bg-white'
                      }`}>
                      <div className={`text-sm leading-none ${d.iso === today ? 'text-brand-600' : 'text-ink'}`}>{d.day}</div>
                      <div className="text-[9px] text-muted mt-0.5">{d.weekday}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridRows.map(s => {
                  const special = SPECIAL_ROWS[s.id]
                  const isFirstSpecial = s.id === TRIAL_ID
                  return (
                  <tr key={s.id} className={`group ${isFirstSpecial ? 'border-t-2 border-gray-200' : ''}`}>
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-b border-r border-gray-200 px-2 sm:px-3 py-2 w-[124px] min-w-[124px] max-w-[124px] sm:w-[150px] sm:min-w-[150px] sm:max-w-[150px]">
                      {special ? (
                        <span className="font-semibold text-ink whitespace-nowrap flex items-center gap-1.5">
                          <span className="text-base leading-none">{special.icon}</span> {special.label}
                        </span>
                      ) : (
                        <>
                          <Link
                            href={`/teacher/students/${s.id}`}
                            title={s.archived ? `${s.fullName} (archived)` : s.fullName}
                            onClick={e => { if (drag.current.moved) e.preventDefault() }}
                            className={`font-medium hover:text-brand-600 transition-colors block truncate ${s.archived ? 'text-muted italic' : 'text-ink'}`}
                          >
                            {s.fullName}
                          </Link>
                          {/* Mobile-only balance — the Lessons Left column is
                              hidden below sm to make room for the days. */}
                          {(() => {
                            const lr = lessonsLeftMap.get(s.id)
                            const tone = lr == null ? 'text-gray-400'
                              : lr <= 0 ? 'text-red-600'
                              : lr <= 2 ? 'text-orange-600'
                              : 'text-emerald-600'
                            return (
                              <button
                                onClick={() => openLessons(s.id, s.fullName)}
                                className="sm:hidden mt-0.5 text-[10px] text-muted hover:text-ink"
                              >
                                <span className={`font-bold ${tone}`}>{lr == null ? '—' : lr}</span> left
                              </button>
                            )
                          })()}
                        </>
                      )}
                    </td>
                    <td className="hidden sm:table-cell sm:sticky sm:left-[150px] z-10 bg-white group-hover:bg-gray-50 border-b border-r border-gray-200 p-0 text-center sm:w-[90px] sm:min-w-[90px] sm:max-w-[90px]">
                      {special ? (
                        <span className="text-gray-300">—</span>
                      ) : (() => {
                        const lr = lessonsLeftMap.get(s.id)
                        const tone = lr == null ? 'text-gray-300'
                          : lr <= 0 ? 'text-red-600'
                          : lr <= 2 ? 'text-orange-600'
                          : 'text-emerald-600'
                        return (
                          <button
                            onClick={() => openLessons(s.id, s.fullName)}
                            title="Set lessons left"
                            className="w-full h-full px-2 py-2 flex items-center justify-center gap-1 hover:bg-brand-50 transition-colors"
                          >
                            <span className={`font-bold text-sm ${tone}`}>{lr == null ? '—' : lr}</span>
                          </button>
                        )
                      })()}
                    </td>
                    <td className="hidden sm:table-cell sm:sticky sm:left-[240px] z-10 bg-white group-hover:bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-right sm:w-[84px] sm:min-w-[84px]">
                      {rowTotal(s.id) > 0
                        ? <span className="font-bold text-ink text-[11px]">{formatMoney(rowTotal(s.id), currency)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    {days.map(d => {
                      const cell = byCell.get(`${s.id}|${d.iso}`) ?? []
                      const has = cell.length > 0
                      const sum = cell.reduce((a, p) => a + p.amount, 0)
                      const allPaid = has && cell.every(p => p.status === 'paid')
                      const overdue = has && cell.some(p => p.status === 'pending' && p.due_date && p.due_date < today)
                      const tone = allPaid
                        ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                        : overdue
                          ? 'bg-red-100 hover:bg-red-200 text-red-700'
                          : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                      return (
                        <td key={d.iso} className={`border-b border-r border-gray-100 p-0 w-[56px] min-w-[56px] sm:w-[68px] sm:min-w-[68px] h-11 ${d.weekend && !has ? 'bg-gray-50/40' : ''}`}>
                          <button
                            onClick={() => handleCellClick(s.id, s.fullName, d.iso)}
                            title={has ? cell.map(p => `${formatMoney(p.amount, currency)} ${p.status}`).join(', ') : 'Add payment'}
                            className={`w-full h-11 flex flex-col items-center justify-center transition-colors px-1 ${has ? tone : 'hover:bg-brand-50'}`}
                          >
                            {has ? (
                              <>
                                <span className="text-[10px] font-bold leading-tight truncate max-w-full">{formatMoney(sum, currency)}</span>
                                {cell.length > 1 && <span className="text-[8px] opacity-70 leading-none">{cell.length} items</span>}
                              </>
                            ) : (
                              <span className="opacity-0 group-hover:opacity-30 text-muted">+</span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend + currency */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-200" /> paid</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-200" /> pending</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-200" /> overdue</span>
        <span>· Click a cell to add or open a payment.</span>
        <span className="ml-auto flex items-center gap-2">
          Currency:
          <select
            value={currency}
            onChange={e => startTransition(async () => { await updateTeacherCurrency(e.target.value); router.refresh() })}
            disabled={pending}
            className="input text-[11px] py-1 w-auto"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c} ({currencySymbol(c)})</option>)}
          </select>
        </span>
      </div>

      {/* ── Day-cell popup ── */}
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
              {dayCellPayments.map(p => {
                const overdue = p.status === 'pending' && p.due_date && p.due_date < today
                return (
                  <div key={p.id} className={`rounded-xl border px-3.5 py-3 ${
                    p.status === 'paid' ? 'border-emerald-100 bg-emerald-50/50' : overdue ? 'border-red-200 bg-red-50/50' : 'border-orange-100 bg-orange-50/50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{formatMoney(p.amount, p.currency ?? currency)}</span>
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 uppercase tracking-wide ${
                        p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                      }`}>{p.status}</span>
                      {p.lessons_covered != null && <span className="text-[11px] text-muted">· {p.lessons_covered} lesson{p.lessons_covered === 1 ? '' : 's'}</span>}
                    </div>
                    {p.description && <p className="text-sm text-muted mt-0.5">{p.description}</p>}
                    {p.method && <p className="text-[11px] text-muted mt-0.5">{p.method}</p>}
                    <div className="flex items-center gap-1 mt-2 -mb-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-ink hover:bg-white" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      {p.status === 'pending' && (
                        <button onClick={() => handleMarkPaid(p.id)} disabled={pending} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-white" title="Mark paid"><CircleCheck className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => handleDelete(p.id)} disabled={pending} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )
              })}
            </div>

            <button onClick={() => openAdd(dayCell.studentId, dayCell.date)} className="btn-secondary text-xs w-full justify-center mt-4">
              <Plus className="w-3.5 h-3.5" /> Add another payment this day
            </button>
          </div>
        </div>
      )}

      {/* ── Lessons-left editor ── */}
      {lessonsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setLessonsFor(null)}>
          <div className="card w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-bold text-ink">Lessons left — {lessonsFor.name}</h3>
              <button onClick={() => setLessonsFor(null)} className="text-gray-400 hover:text-ink"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-muted mb-4">
              Set how many prepaid lessons remain. This goes down by 1 automatically every time a new lesson
              is added for this student. Leave blank to stop tracking.
            </p>

            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">Lessons remaining</label>
            <input
              type="number"
              value={lessonsDraft}
              onChange={e => setLessonsDraft(e.target.value)}
              placeholder="not tracked"
              className="input w-full text-sm mt-1"
              autoFocus
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {[1, 4, 8, 10].map(n => (
                <button key={n} onClick={() => bumpLessons(n)} className="btn-ghost text-xs border border-gray-200">+{n}</button>
              ))}
              <button onClick={() => setLessonsDraft('')} className="btn-ghost text-xs text-muted ml-auto">Clear</button>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setLessonsFor(null)} className="btn-ghost text-xs" disabled={pending}>Cancel</button>
              <button onClick={saveLessons} className="btn-primary text-xs" disabled={pending}>
                {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / edit modal ── */}
      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeModal}>
          <div className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-brand-600" />
                <h3 className="font-bold text-ink">{mode === 'add' ? 'New Payment' : 'Payment Details'}</h3>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-ink"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              {mode === 'add' ? (
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">Student</label>
                  <select value={studentId} onChange={e => setStudentId(e.target.value)} className="input w-full text-sm mt-1">
                    <option value="">Select a student…</option>
                    {[...visibleStudents].sort(byName).map(s => (
                      <option key={s.id} value={s.id}>{s.fullName}{s.archived ? ' (archived)' : ''}</option>
                    ))}
                    <option value={TRIAL_ID}>🎓 Trial lesson (not a student)</option>
                    <option value={OTHER_ID}>✨ Other (not a student)</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-3.5 py-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                    style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                    {editing && SPECIAL_ROWS[editing.studentId] ? SPECIAL_ROWS[editing.studentId].icon : editing?.studentName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-ink text-sm">{editing?.studentName}</span>
                  {editing && !SPECIAL_ROWS[editing.studentId] && (
                    <Link href={`/teacher/students/${editing.studentId}`} className="ml-auto text-gray-300 hover:text-brand-600"><Chevron className="w-4 h-4" /></Link>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">Amount ({currencySymbol(currency)})</label>
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="input w-full text-sm mt-1" autoFocus={mode === 'add'} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'paid' | 'pending' })} className="input w-full text-sm mt-1">
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">What it covers</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. June package — 4 lessons" className="input w-full text-sm mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">{form.status === 'paid' ? 'Payment date' : 'Due date'}</label>
                  <input type="date"
                    value={form.status === 'paid' ? form.payment_date : form.due_date}
                    onChange={e => setForm(form.status === 'paid' ? { ...form, payment_date: e.target.value } : { ...form, due_date: e.target.value })}
                    className="input w-full text-sm mt-1" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">Lessons covered</label>
                  <input type="number" min="0" step="1" value={form.lessons_covered}
                    onChange={e => setForm({ ...form, lessons_covered: e.target.value })} placeholder="optional" className="input w-full text-sm mt-1" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">Method</label>
                <input value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}
                  placeholder="e.g. Bank transfer, Cash, Revolut" className="input w-full text-sm mt-1" />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex items-center gap-2 pt-2">
                {mode === 'edit' && editing && (
                  <>
                    <button onClick={() => handleDelete(editing.id)} disabled={pending} className="btn-ghost text-xs text-red-500 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                    {editing.status === 'pending' && (
                      <button onClick={() => handleMarkPaid(editing.id)} disabled={pending} className="btn-secondary text-xs">
                        <CircleCheck className="w-3.5 h-3.5" /> Mark paid
                      </button>
                    )}
                  </>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={closeModal} className="btn-ghost text-xs" disabled={pending}>Cancel</button>
                  <button onClick={handleSubmit} className="btn-primary text-xs" disabled={pending}>
                    {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {mode === 'add' ? 'Add Payment' : 'Save'}
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
