import { createClient } from '@/lib/supabase/server'
import { StickyNote } from 'lucide-react'
import NotesManager, { ManagedNote, StudentOption } from '@/components/teacher/NotesManager'

export default async function NotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: students }, { data: notes }] = await Promise.all([
    supabase.from('students').select('id, full_name').eq('teacher_id', user!.id).order('full_name'),
    supabase.from('student_notes').select('*').eq('teacher_id', user!.id),
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

  const studentOptions: StudentOption[] = (students ?? []).map(s => ({ id: s.id, fullName: s.full_name }))

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <StickyNote className="w-5 h-5 text-brand-600" />
          <h1 className="text-2xl font-bold text-ink">Notes</h1>
        </div>
        <p className="text-sm text-muted">Your private notes after each lesson — all in one place. Only you can see these.</p>
      </div>

      <NotesManager students={studentOptions} notes={managedNotes} />
    </div>
  )
}
