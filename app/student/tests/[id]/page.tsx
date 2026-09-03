import { createClient, getUser } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, FileText } from 'lucide-react'
import TestRunner from '@/components/student/TestRunner'
import Furigana from '@/components/Furigana'
import { sameAnswer } from '@/lib/furigana'
import { groupBySection, testScore } from '@/lib/utils'
import type { TestQuestion, TestSubmission } from '@/lib/types'

const TYPE_LABEL: Record<string, string> = {
  written: '✍️ Written',
  speak: '🎙️ Speaking',
  read_aloud: '🎙️ Read aloud',
  reading_passage: '📖 Reading',
  multiple_choice: '✅ Multiple choice',
  fill_blank: '✏️ Fill in the blank',
}

export default async function StudentTestPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const user = await getUser() // memoized, shared with the layout
  if (!user) redirect('/login')

  const { data: student } = await supabase
    .from('students').select('id').eq('profile_id', user.id).single()
  if (!student) notFound()

  const { data: test } = await supabase
    .from('tests')
    .select('id, title, instructions, duration_minutes, lesson_numbers, status, test_questions ( * )')
    .eq('id', params.id)
    .eq('status', 'published')
    .single()
  if (!test) notFound()

  const [{ data: attempt }, { data: submissions }] = await Promise.all([
    supabase.from('test_attempts').select('started_at, submitted_at').eq('test_id', params.id).eq('student_id', student.id).maybeSingle(),
    supabase.from('test_submissions').select('*').eq('test_id', params.id).eq('student_id', student.id),
  ])

  const questions = ((test.test_questions as any as TestQuestion[]) ?? []).sort((a, b) => a.sort_order - b.sort_order)
  const subs = (submissions as any as TestSubmission[]) ?? []

  const backLink = (
    <Link href="/student/dashboard" className="btn-ghost text-xs mb-3 -ml-1 inline-flex">
      <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
    </Link>
  )

  // Already submitted → show read-only results with teacher feedback
  if (attempt?.submitted_at) {
    const subByQ = new Map(subs.map(s => [s.question_id, s]))
    // Multiple-choice and fill-in answers are marked the moment they're saved,
    // but speaking and writing wait on Noa. Showing a bare "12 / 26" straight
    // after submitting reads as a bad mark when really half of it is unmarked.
    const { score, maxScore, awaiting } = testScore(questions, subs)
    const anyGraded = score > 0 || subs.some(s => s.score != null)

    return (
      <div className="space-y-4">
        {backLink}
        <div className="card p-6">
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-600" /> {test.title}
          </h1>
          <p className="text-sm text-muted mt-1">You submitted this test.</p>

          {!anyGraded ? (
            <p className="mt-3 text-sm text-brand-600 bg-brand-50 rounded-xl px-4 py-2 inline-block">
              ⏳ Your teacher is reviewing your answers.
            </p>
          ) : awaiting > 0 ? (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm font-bold text-amber-800">
                So far: {score} / {maxScore} — not your final score yet
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Only the multiple-choice and fill-in-the-blank answers are marked automatically.
                Noa still has {awaiting} answer{awaiting !== 1 ? 's' : ''} to mark by hand — your speaking
                and writing. Your score will go up as she marks them.
              </p>
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
              Final score: {score} / {maxScore}
            </div>
          )}
        </div>

        {(() => {
          let n = 0
          return groupBySection(questions).map(section => (
            <div key={section.key} className="space-y-4">
              <div className="flex items-center gap-2 pt-2">
                {section.part && <span className="text-[11px] font-bold uppercase tracking-wide text-white bg-brand-600 rounded-full px-2.5 py-0.5">{section.part}</span>}
                <h2 className="text-base font-bold text-ink">{section.title}</h2>
              </div>
              {section.items.map(q => {
                const s = subByQ.get(q.id)
                const isPassage = q.type === 'reading_passage'
                if (!isPassage) n += 1
                const isChoice = q.type === 'multiple_choice' || q.type === 'fill_blank'
                let choiceLabel: string | null = null
                let choiceCorrect = false
                if (isChoice && s?.answer_text != null) {
                  if (q.type === 'multiple_choice') {
                    const idx = Number(s.answer_text)
                    choiceLabel = (q.data?.options ?? [])[idx] ?? String(s.answer_text)
                    choiceCorrect = idx === Number(q.data?.answer)
                  } else {
                    choiceLabel = String(s.answer_text)
                    // Furigana-insensitive, matching how the answer was graded.
                    choiceCorrect = sameAnswer(choiceLabel, String(q.data?.answer ?? ''))
                  }
                }
                const correctText = q.type === 'multiple_choice'
                  ? (q.data?.options ?? [])[Number(q.data?.answer)]
                  : q.data?.answer
                return (
                  <div key={q.id} className="card p-5">
                    <div className="flex items-center gap-2 mb-2">
                      {!isPassage && <span className="text-xs font-bold text-ink bg-gray-100 rounded-full w-6 h-6 inline-flex items-center justify-center">{n}</span>}
                      <span className="text-[11px] font-bold text-brand-600 bg-brand-50 border border-indigo-100 rounded-full px-2.5 py-0.5">{TYPE_LABEL[q.type] ?? q.type}</span>
                      {!isPassage && (
                        s?.score != null
                          ? <span className="text-[11px] font-bold text-emerald-600">{s.score}/{q.points}</span>
                          : <span className="text-[11px] font-semibold text-amber-600">Noa still to mark</span>
                      )}
                    </div>

                    {isPassage ? (
                      <div className="rounded-lg bg-[#f8f7ff] border border-gray-100 px-4 py-3">
                        <p className="text-base text-ink leading-relaxed whitespace-pre-line"><Furigana text={q.data?.text} /></p>
                        {q.data?.romaji && <p className="text-sm text-brand-600 italic leading-relaxed whitespace-pre-line mt-1">{q.data.romaji}</p>}
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-ink"><Furigana text={q.type === 'multiple_choice' ? (q.data?.question || q.prompt) : q.prompt} /></p>
                        {q.type === 'multiple_choice' && q.data?.question_romaji && <p className="text-xs text-brand-600 italic mb-1">{q.data.question_romaji}</p>}
                        <div className="mb-2" />
                        {isChoice ? (
                          <>
                            <p className={`text-sm font-semibold ${choiceCorrect ? 'text-green-600' : 'text-red-600'}`}>
                              Your answer: {choiceLabel ? <Furigana text={choiceLabel} /> : '—'} {s?.answer_text != null ? (choiceCorrect ? '✓' : '✗') : ''}
                            </p>
                            {!choiceCorrect && correctText != null && (
                              <p className="text-xs text-green-600 font-semibold mt-1">Correct answer: <Furigana text={correctText} /></p>
                            )}
                          </>
                        ) : (
                          <>
                            {s?.answer_text && <p className="text-sm text-ink bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-line">{s.answer_text}</p>}
                            {s?.audio_url && <audio controls src={s.audio_url} className="w-full h-9 mt-1" />}
                            {!s?.answer_text && !s?.audio_url && <p className="text-xs text-muted italic">No answer submitted.</p>}
                          </>
                        )}
                        {s?.teacher_feedback && (
                          <div className="mt-2.5 p-3 rounded-lg border border-brand-200 bg-brand-50">
                            <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mb-1">Noa Feedback</p>
                            <p className="text-sm text-ink whitespace-pre-line">{s.teacher_feedback}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        })()}
      </div>
    )
  }

  // Not submitted → take the test
  return (
    <div className="space-y-4">
      {backLink}
      <TestRunner
        test={test as any}
        questions={questions}
        studentId={student.id}
        initialSubmissions={subs}
        startedAt={attempt?.started_at ?? null}
      />
    </div>
  )
}
