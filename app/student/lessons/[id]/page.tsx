import { createClient, getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { formatDateShort } from '@/lib/utils'
import HomeworkSubmitSection from '@/components/student/HomeworkSubmitSection'
import StudentAudioSubmit from '@/components/student/StudentAudioSubmit'
import LessonExercises from '@/components/student/LessonExercises'
import LessonPageTabs from '@/components/koku/LessonPageTabs'
import LegacyRecap from '@/components/student/LegacyRecap'
import { usesNewRecap } from '@/lib/recapEra'
import { buildRecap } from '@/lib/recapShape'
import { resolveBrand } from '@/lib/brand'

/**
 * A published lesson, as the student reads it.
 *
 * The page is Lesson Studio's recap, component for component: the brand band
 * with the score, the rail of movements down the side, and the write-up as one
 * scroll — how you spoke, what you nailed, what to fix, what you covered, the
 * words, then practice. The only thing this portal supplies of its own is the
 * practice block, because answering an exercise and recording yourself write
 * to this portal's tables.
 */
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

  // The teacher's display name (admin read — non-sensitive, and RLS keeps a
  // student out of the profiles table).
  const admin = createAdminClient()
  const { data: teacherProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', student.teacher_id)
    .single()
  const teacherFirst = teacherProfile?.full_name?.split(' ')[0] || 'your teacher'

  const bySort = (a: any, b: any) => a.sort_order - b.sort_order
  const attachments = (lesson.lesson_attachments || []).sort(bySort)
  const vocab = (lesson.vocabulary_items || []).sort(bySort)
  const homework = (lesson.homework_items || []).sort(bySort)
  const exercises = (lesson.lesson_exercises || []).sort(bySort)
  const summary = lesson.lesson_summaries

  const [{ data: hwSubmissions }, { data: audioSubmissions }, { data: exSubmissions }] = await Promise.all([
    supabase.from('homework_submissions').select('*').eq('lesson_id', params.id).order('created_at'),
    supabase.from('student_audio_submissions').select('*').eq('lesson_id', params.id).order('created_at'),
    supabase.from('exercise_submissions').select('exercise_id, answer, is_correct').eq('lesson_id', params.id),
  ])

  // Recordings tied to a speaking exercise vs. free practice for the lesson.
  const exerciseAudio = (audioSubmissions ?? []).filter((a: any) => a.exercise_id)
  const generalAudio = (audioSubmissions ?? []).filter((a: any) => !a.exercise_id)

  /**
   * The last section is the corrections write-up on lessons made before
   * corrections were structured. LessonPageTabs recognises it by title and
   * renders it in the "what to fix" movement, so it stays in `sections`.
   */
  const sections = (lesson.lesson_sections || []).sort(bySort)

  // Lessons already taught keep the recap their student knows; everything
  // from the cutoff on gets the new one. See lib/recapEra.
  if (!usesNewRecap(lesson)) {
    const mainTakeaways = sections.find((s: any) => /main takeaway|takeaways|corrections|refinement/i.test(s.title)) ?? null
    return (
      <LegacyRecap
        lesson={lesson}
        student={student}
        teacherFirstName={teacherFirst}
        summary={summary}
        sections={sections.filter((s: any) => !/main takeaway|takeaways|corrections|refinement/i.test(s.title))}
        mainTakeaways={mainTakeaways}
        vocab={vocab}
        homework={homework}
        exercises={exercises}
        attachments={attachments}
        hwSubmissions={hwSubmissions ?? []}
        exSubmissions={exSubmissions ?? []}
        exerciseAudio={exerciseAudio}
        generalAudio={generalAudio}
      />
    )
  }

  const recap = buildRecap({ lesson, summary, sections, vocabulary: vocab, homework })
  // The count in the rail should say what the practice movement actually holds.
  recap.exercises = exercises as any[]

  const studentFirst = student.full_name.split(' ')[0]
  const brand = resolveBrand(null)

  /** This portal's own practice block — it saves what the student does. */
  const practice = (
    <div style={{ display: 'grid', gap: 12 }}>
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
      <StudentAudioSubmit
        lessonId={lesson.id}
        studentId={student.id}
        initialSubmissions={generalAudio}
      />
    </div>
  )

  const files = attachments.length > 0 ? (
    <div className="lesson-block">
      <h3>📎 Files from {teacherFirst}</h3>
      <div className="k-hw">
        {attachments.map((a: any) => (
          <a key={a.id} href={a.file_url} target="_blank" rel="noopener noreferrer"
             style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="k-file-ic" aria-hidden>
              <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v5h5M6 3h8l5 5v13H6z" /></svg>
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="k-hw-title">{a.file_name}</span>
            </span>
            <span className="k-btn-pill">Open</span>
          </a>
        ))}
      </div>
    </div>
  ) : undefined

  const voiceUrl = (lesson as any).voice_file_url

  return (
    <div style={{ maxWidth: 1180 }}>
      <header className="k-phead">
        <div>
          <div className="k-phead-eyebrow">Lesson {lesson.lesson_number} · Recap</div>
          <h1>{lesson.title || `Lesson ${lesson.lesson_number}`}</h1>
          <div className="k-pmeta">
            <span>{formatDateShort(lesson.lesson_date)}</span>
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

      {/* What the teacher said to this student personally — her recording, her
          note, or both. It opens the recap rather than sitting in a movement
          halfway down, the same place Lesson Studio puts a voice memo. */}
      {(voiceUrl || summary?.teacher_note) && (
        <div className="k-card" style={{ marginBottom: 14 }}>
          <div className="k-card-head"><h3>A message from {teacherFirst}</h3></div>
          {voiceUrl && <audio controls style={{ width: '100%', marginBottom: summary?.teacher_note ? 12 : 0 }} src={voiceUrl} />}
          {summary?.teacher_note && (
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65 }}>{summary.teacher_note}</p>
          )}
        </div>
      )}

      <LessonPageTabs
        lesson={{
          id: lesson.id,
          lessonNumber: lesson.lesson_number,
          date: lesson.lesson_date,
          title: lesson.title ?? '',
          recap,
        }}
        studentFirst={studentFirst}
        teacherFirst={teacherFirst}
        brand={brand}
        language={student.language ?? null}
        back={{ href: '/student/dashboard', label: 'Dashboard' }}
        exercises={practice}
        files={files}
      />
    </div>
  )
}
