import { createClient, getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort } from '@/lib/utils'
import { ArrowLeft, CheckCircle, Circle } from 'lucide-react'
import SectionContent from '@/components/student/SectionContent'
import VocabLevelBreakdown, { JLPT_COLORS, JLPT_LABELS } from '@/components/student/VocabLevelBreakdown'
import HomeworkSubmitSection from '@/components/student/HomeworkSubmitSection'
import StudentAudioSubmit from '@/components/student/StudentAudioSubmit'
import RecapFlow, { type Movement } from '@/components/student/RecapFlow'
import LessonMetrics from '@/components/student/LessonMetrics'
import LessonExercises from '@/components/student/LessonExercises'

export default async function StudentLessonPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const user = await getUser() // memoized, shared with the layout
  if (!user) redirect('/login')

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('profile_id', user.id)
    .single()
  if (!student) redirect('/student/dashboard')

  const { data: lesson } = await supabase
    .from('lessons')
    .select(`*, lesson_summaries ( * ), vocabulary_items ( * ), homework_items ( * ), lesson_sections ( * ), lesson_attachments ( * ), lesson_exercises ( * )`)
    .eq('id', params.id)
    .eq('student_id', student.id)
    .eq('status', 'published')
    .single()

  if (!lesson) notFound()

  // Fetch teacher's display name (bypasses RLS — read-only, non-sensitive)
  const admin = createAdminClient()
  const { data: teacherProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', student.teacher_id)
    .single()
  const teacherFirstName = teacherProfile?.full_name?.split(' ')[0] || 'your teacher'

  const attachments = (lesson.lesson_attachments || []).sort((a: any, b: any) => a.sort_order - b.sort_order)

  const { data: hwSubmissions } = await supabase
    .from('homework_submissions')
    .select('*')
    .eq('lesson_id', params.id)
    .order('created_at')

  const { data: audioSubmissions } = await supabase
    .from('student_audio_submissions')
    .select('*')
    .eq('lesson_id', params.id)
    .order('created_at')
  const { data: exSubmissions } = await supabase
    .from('exercise_submissions')
    .select('exercise_id, answer, is_correct')
    .eq('lesson_id', params.id)

  const vocab     = (lesson.vocabulary_items || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  const homework  = (lesson.homework_items   || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  const exercises = (lesson.lesson_exercises || []).sort((a: any, b: any) => a.sort_order - b.sort_order)

  // Recordings tied to a speaking exercise vs. general practice
  const exerciseAudio = (audioSubmissions ?? []).filter((a: any) => a.exercise_id)
  const generalAudio  = (audioSubmissions ?? []).filter((a: any) => !a.exercise_id)
  const allSections   = (lesson.lesson_sections || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  const mainTakeaways = allSections.find((s: any) => /main takeaway|takeaways|corrections|refinement/i.test(s.title)) ?? null
  const sections      = allSections.filter((s: any) => !/main takeaway|takeaways|corrections|refinement/i.test(s.title))
  const summary  = lesson.lesson_summaries

  const studentTalk = summary?.talk_percentage ?? 40
  const teacherTalk = 100 - studentTalk

  const voiceUrl = (lesson as any).voice_file_url
  const hasProgress = Boolean(summary || voiceUrl || summary?.teacher_note || attachments.length > 0)

  // ── PROGRESS panel ──────────────────────────────────────────────────────────
  const progressPanel = (
    <>
      {summary && (
        <div className="card p-5" style={{ background: 'linear-gradient(180deg,#ffffff 0%,#f8f7ff 100%)', border: '1px solid rgba(10,97,201,0.16)' }}>
          <h2 className="font-bold text-brand-800 text-base mb-4">📊 Lesson Dashboard</h2>

          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            {/* Speaking Balance */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Speaking Balance</p>
              <p className="text-2xl font-extrabold text-brand-600 leading-none mb-1">
                {studentTalk}% / {teacherTalk}%
              </p>
              <div className="space-y-1.5 mt-3">
                {[
                  { label: student.full_name.split(' ')[0], pct: studentTalk, student: true },
                  { label: teacherFirstName,                 pct: teacherTalk, student: false },
                ].map(({ label, pct, student: isStu }) => (
                  <div key={label} className="grid gap-2" style={{ gridTemplateColumns: '64px 1fr 36px', alignItems: 'center', fontSize: '0.82rem', fontWeight: 700 }}>
                    <span className="text-muted truncate">{label}</span>
                    <div className="h-2 rounded-full bg-indigo-50 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: isStu
                            ? 'linear-gradient(135deg,#a24ee0,#facc15)'
                            : 'linear-gradient(135deg,#0a61c9,#a24ee0)',
                        }}
                      />
                    </div>
                    <span className="text-right text-muted">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Confidence */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Confidence / Independence</p>
              <p className="text-2xl font-extrabold text-brand-600 leading-none">
                {summary.confidence_label || 'Building'}
              </p>
              {summary.score != null && (
                <div className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-brand-800 font-extrabold text-sm">
                  {summary.score} / 10
                </div>
              )}
            </div>

            {/* Grammar Density */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Grammar Density</p>
              <p className="text-2xl font-extrabold text-brand-600 leading-none">
                {summary.grammar_density || '—'}
              </p>
            </div>
          </div>

          {/* Main Takeaways — inside dashboard */}
          {mainTakeaways && (
            <div className="border-t border-indigo-50 pt-4 mt-1">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Main Corrections & Refinements</p>
              <SectionContent content={mainTakeaways.content} />
            </div>
          )}
        </div>
      )}

      {/* Teacher's Audio Review */}
      {voiceUrl && (
        <div className="card p-6" style={{ border: '1px solid rgba(10,97,201,0.12)' }}>
          <h2 className="section-title mb-1">🎙️ Noa's Audio Review</h2>
          <audio controls className="w-full" src={voiceUrl} />
        </div>
      )}

      {/* Teacher's Note */}
      {summary?.teacher_note && (
        <div className="card p-6" style={{ background: 'linear-gradient(180deg,#ffffff,#f7f4ff)', border: '1px solid rgba(10,97,201,0.12)' }}>
          <h2 className="section-title mb-3">🌟 Noa's Note</h2>
          <p className="text-sm text-ink/85 leading-relaxed">{summary.teacher_note}</p>
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="card p-6">
          <h2 className="section-title mb-4">📎 Files from your teacher</h2>
          <ul className="space-y-2">
            {attachments.map((a: any) => (
              <li key={a.id}>
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                  <span className="text-2xl">📄</span>
                  <span className="text-sm font-medium text-brand-700">{a.file_name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasProgress && (
        <div className="card p-8 text-center text-muted text-sm">No progress details for this lesson yet.</div>
      )}
    </>
  )

  // ── LESSON panel ────────────────────────────────────────────────────────────
  const lessonPanel = sections.length > 0 ? (
    <>
      {sections.map((section: any) => (
        <div key={section.id} className="card p-6">
          <h2 className="font-bold text-brand-800 text-base mb-4">{section.title}</h2>
          {section.content && <SectionContent content={section.content} />}
        </div>
      ))}
    </>
  ) : (
    <div className="card p-8 text-center text-muted text-sm">No lesson sections for this lesson.</div>
  )

  // ── HOMEWORK panel ──────────────────────────────────────────────────────────
  const homeworkPanel = (
    <>
      {/* Your Tasks — first */}
      {homework.length > 0 && (
        <div className="card p-6">
          <h2 className="section-title mb-4">📝 Your Tasks <span className="text-muted font-normal text-sm">(宿題)</span></h2>
          <ul className="space-y-2">
            {homework.map((hw: any) => (
              <li key={hw.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                {hw.completed
                  ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  : <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />}
                <span className={`text-sm ${hw.completed ? 'line-through text-muted' : 'text-ink'}`}>
                  {hw.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Practice Exercises — only if Noa chose to show them */}
      {exercises.length > 0 && (lesson as any).show_exercises !== false && (
        <LessonExercises
          lessonId={lesson.id}
          studentId={student.id}
          exercises={exercises as any}
          submissions={(exSubmissions ?? []) as any}
          audioSubmissions={exerciseAudio as any}
        />
      )}

      {homework.length > 0 && (
        <HomeworkSubmitSection
          lessonId={lesson.id}
          studentId={student.id}
          initialSubmissions={hwSubmissions ?? []}
        />
      )}

      {/* Practice recording — general, for anything the student wants to share */}
      <StudentAudioSubmit
        lessonId={lesson.id}
        studentId={student.id}
        initialSubmissions={generalAudio}
      />
    </>
  )

  // ── VOCABULARY panel ────────────────────────────────────────────────────────
  const vocabPanel = vocab.length > 0 ? (
    <div className="card p-6">
      <h2 className="section-title mb-1">📖 Key Vocabulary</h2>
      <p className="text-xs text-muted mb-4">Showing {vocab.length} key vocabulary items from this lesson.</p>
      <div className="space-y-3">
        {vocab.map((v: any) => (
          <div key={v.id} className="rounded-xl border border-indigo-50 bg-[#f8f7ff] p-4">
            {/* Word + level badge */}
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="font-bold text-brand-800 text-base">{v.word}</span>
              {v.jlpt_level && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    background: (JLPT_COLORS[v.jlpt_level] ?? '#4da3ff') + '22',
                    color: JLPT_COLORS[v.jlpt_level] ?? '#4da3ff',
                    border: `1px solid ${(JLPT_COLORS[v.jlpt_level] ?? '#4da3ff')}40`,
                  }}
                >
                  {JLPT_LABELS[v.jlpt_level] ?? v.jlpt_level}
                </span>
              )}
            </div>
            {/* Romaji */}
            {v.reading && (
              <p className="text-xs text-purple-500 font-semibold italic mb-1">{v.reading}</p>
            )}
            <p className="text-sm text-muted">{v.definition}</p>
            {v.example_sentence && (
              <p className="text-xs text-muted/70 italic mt-2 border-l-2 border-brand-200 pl-3">
                {v.example_sentence}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="card p-8 text-center text-muted text-sm">No vocabulary for this lesson.</div>
  )

  /**
   * The recap as a sequence rather than a set of drawers.
   *
   * Order is the story of the hour: how you spoke, what you got right, what to
   * fix, what you covered, the words, then practice. A movement with nothing
   * in it is dropped by RecapFlow, which is what lets every lesson recorded
   * before the new pipeline render unchanged — it simply has fewer movements.
   */
  const metrics = (summary as any)?.metrics ?? null
  const corrections: any[] = Array.isArray((summary as any)?.corrections) ? (summary as any).corrections : []
  const didWell: any[] = Array.isArray((summary as any)?.did_well) ? (summary as any).did_well : []
  const studentFirst = student.full_name.split(' ')[0]

  const movements: Movement[] = [
    {
      id: 'spoke',
      label: 'How you spoke',
      node: hasProgress ? (
        <>
          {progressPanel}
          <LessonMetrics metrics={metrics} studentFirst={studentFirst} />
        </>
      ) : null,
    },
    {
      id: 'won',
      label: 'What you nailed',
      count: didWell.length ? String(didWell.length) : null,
      node: didWell.length ? (
        <div className="card p-5">
          <ul className="space-y-3">
            {didWell.map((d: any, i: number) => (
              <li key={i}>
                <p className="text-sm font-bold text-ink">&ldquo;{d?.said}&rdquo;</p>
                {d?.note && <p className="text-xs text-muted mt-1 leading-relaxed">{d.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      ) : null,
    },
    {
      id: 'fix',
      label: 'What to fix',
      count: corrections.length ? String(corrections.length) : null,
      node: corrections.length ? (
        <div className="card p-5">
          <ul className="space-y-4">
            {corrections.map((c: any, i: number) => (
              <li key={i}>
                <p className="text-sm text-muted line-through">{c?.said}</p>
                <p className="text-sm font-bold text-ink mt-0.5">{c?.correction}</p>
                {c?.explanation && <p className="text-xs text-muted mt-1 leading-relaxed">{c.explanation}</p>}
              </li>
            ))}
          </ul>
        </div>
      ) : null,
    },
    {
      id: 'covered',
      label: 'What we covered',
      count: sections.length ? String(sections.length) : null,
      node: sections.length ? lessonPanel : null,
    },
    {
      id: 'words',
      label: 'Words from today',
      count: vocab.length ? String(vocab.length) : null,
      node: vocab.length ? vocabPanel : null,
    },
    { id: 'practice', label: 'Practice', node: homeworkPanel },
  ]

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 48 }} className="space-y-5">
      {/* ── The brand band — Lesson Studio's lesson header, score medallion and all ── */}
      <header className="k-phead">
        <div>
          <div className="k-phead-eyebrow">Lesson {lesson.lesson_number} · Recap</div>
          <h1>{lesson.title || `Lesson ${lesson.lesson_number}`}</h1>
          <div className="k-pmeta">
            <span>{formatDateShort(lesson.lesson_date)}</span>
            <span>{student.full_name.split(' ')[0]} &amp; {teacherFirstName}</span>
            {summary?.confidence_label && <span>{summary.confidence_label}</span>}
          </div>
        </div>
        {summary?.score != null && (
          <div className="k-pscore">
            <div>
              <b>{summary.score}</b>
              <small>OUT OF 10</small>
            </div>
          </div>
        )}
        <div className="k-hero-art" style={{ right: 150, opacity: .4 }} aria-hidden>
          <span className="k-orb" style={{ width: 70, height: 70, right: 0, top: 10 }} />
          <span className="k-tube" style={{ width: 56, height: 56, right: 60, top: 74, transform: 'rotate(40deg)' }} />
        </div>
      </header>

      {/* ── The recap, as one scroll ──────────────────────────────────── */}
      <RecapFlow movements={movements} back={{ href: '/student/dashboard', label: 'Dashboard' }} />
    </div>
  )
}
