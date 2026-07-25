import { createClient, getUser } from '@/lib/supabase/server'
import { StickyNote } from 'lucide-react'
import NotesManager, { ManagedNote, StudentOption } from '@/components/teacher/NotesManager'
import { EarningsPayment } from '@/lib/earnings'

export default async function NotesPage() {
  const supabase = await createClient()
  const user = await getUser() // memoized, shared with the layout

  const [{ data: students }, { data: notes }, { data: payments }, { data: profile }] = await Promise.all([
    supabase.from('students').select('id, full_name, archived_at').eq('teacher_id', user!.id).order('full_name'),
    supabase.from('student_notes').select('*').eq('teacher_id', user!.id),
    supabase.from('payments').select('amount, status, payment_date').eq('teacher_id', user!.id),
    supabase.from('profiles').select('currency').eq('id', user!.id).single(),
  ])

  const studentName = new Map((students ?? []).map(s => [s.id, s.full_name]))

  const managedNotes: ManagedNote[] = (notes ?? []).map(n => ({
    id: n.id,
    studentId: n.student_id,
    studentName: studentName.get(n.student_id) ?? 'Unknown',
    content: n.content,
    pinned: n.pinned,
    note_date: n.note_date ?? (n.created_at ? n.created_at.slice(0, 10) : ''),
    created_at: n.created_at,
  }))

  const studentOptions: StudentOption[] = (students ?? []).map(s => ({
    id: s.id,
    fullName: s.full_name,
    archived: !!(s as any).archived_at,
  }))

  // Archived students' payments still count — see lib/earnings.ts.
  const earningsPayments: EarningsPayment[] = (payments ?? []).map(p => ({
    status: p.status,
    payment_date: p.payment_date,
    amount: Number(p.amount),
  }))

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <StickyNote className="w-5 h-5 text-brand-600" />
          <h1 className="text-2xl font-bold text-ink">Notes</h1>
        </div>
        <p className="text-sm text-muted">Your private notes after each lesson — all in one place. Only you can see these.</p>
      </div>

      <NotesManager
        students={studentOptions}
        notes={managedNotes}
        payments={earningsPayments}
        currency={profile?.currency ?? 'EUR'}
      />
    </div>
  )
}
