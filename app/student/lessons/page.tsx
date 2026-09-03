import { createClient, getUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort, ordinal } from '@/lib/utils'
import LessonPillar, { type PillarLesson } from '@/components/student/LessonPillar'

export default async function LessonsPage() {
  const supabase = await createClient()
  const user = await getUser() // memoized, shared with the layout
  if (!user) redirect('/login')

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('profile_id', user.id)
    .single()

  if (!student) redirect('/student/dashboard')

  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      id, lesson_number, lesson_date, title,
      lesson_summaries ( score, recap ),
      homework_items ( id, completed )
    `)
    .eq('student_id', student.id)
    .eq('status', 'published')
    .order('lesson_number', { ascending: false })

  const rows = (lessons || []) as any[]
  const pillar: PillarLesson[] = rows.map((lesson) => ({
    id: lesson.id,
    number: lesson.lesson_number,
    title: lesson.title || `Lesson ${lesson.lesson_number}`,
    desc: lesson.lesson_summaries?.recap ?? undefined,
    meta: `${ordinal(lesson.lesson_number)} lesson · ${formatDateShort(lesson.lesson_date)}`,
    score: lesson.lesson_summaries?.score ?? null,
    tag: `Lesson ${lesson.lesson_number}`,
    openHomework: (lesson.homework_items || []).filter((h: any) => !h.completed).length,
  }))

  return (
    <div style={{ maxWidth: 860 }}>
      <Link href="/student/dashboard" className="k-back">← Dashboard</Link>
      <div className="k-top" style={{ marginBottom: 16 }}>
        <div>
          <p className="k-hello">Your lesson library</p>
          <h1 className="k-name" style={{ fontSize: 'clamp(24px,3vw,32px)' }}>{rows.length} lesson{rows.length === 1 ? '' : 's'}</h1>
        </div>
      </div>
      <div data-tour="lessons">
        <LessonPillar lessons={pillar} />
      </div>
    </div>
  )
}
