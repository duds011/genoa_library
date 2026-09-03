import { createClient, getUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TestReview from '@/components/teacher/TestReview'

export default async function TestReviewPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const user = await getUser() // memoized, shared with the layout

  const { data: test } = await supabase
    .from('tests')
    .select(`
      id, title, instructions, status, duration_minutes, lesson_numbers, student_id, config,
      students ( full_name ),
      test_questions ( * )
    `)
    .eq('id', params.id)
    .eq('teacher_id', user!.id)
    .single()

  if (!test) notFound()

  const [{ data: submissions }, { data: attempt }] = await Promise.all([
    supabase.from('test_submissions').select('*').eq('test_id', params.id),
    supabase.from('test_attempts').select('submitted_at').eq('test_id', params.id).maybeSingle(),
  ])

  return (
    <div className="k-page" style={{ display: 'grid', gap: 16 }}>
      <div>
        <Link href={`/teacher/students/${test.student_id}`} className="btn btn-ghost btn-sm">
          <ArrowLeft className="w-3.5 h-3.5" /> {(test.students as any)?.full_name ?? 'Student'}
        </Link>
      </div>
      <TestReview
        test={test as any}
        questions={(test.test_questions as any) ?? []}
        submissions={(submissions as any) ?? []}
        submitted={!!attempt?.submitted_at}
      />
    </div>
  )
}
