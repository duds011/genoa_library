import Link from 'next/link'
import { ArrowLeft, CheckCircle, Circle } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import SectionContent from './SectionContent'
import { JLPT_COLORS, JLPT_LABELS } from './VocabLevelBreakdown'
import HomeworkSubmitSection from './HomeworkSubmitSection'
import StudentAudioSubmit from './StudentAudioSubmit'
import LessonExercises from './LessonExercises'
import LessonTabs from './LessonTabs'

/**
 * The recap as it has always looked — four tabs, the Lesson Dashboard card,
 * Noa's note.
 *
 * Every lesson taught before the recorder is written this way, and a student
 * who has read forty of them should not find the forty-first rearranged
 * underneath them. So this is kept exactly as it shipped, and the new design
 * applies only to lessons recorded from here on. See the page that picks
 * between the two.
 *
 * Frozen on purpose: change it only to fix something broken.
 */
export default function LegacyRecap({
  lesson, student, teacherFirstName, summary, sections, mainTakeaways,
  vocab, homework, exercises, attachments, hwSubmissions, exSubmissions,
  exerciseAudio, generalAudio,
}: {
  lesson: any; student: any; teacherFirstName: string; summary: any
  sections: any[]; mainTakeaways: any | null
  vocab: any[]; homework: any[]; exercises: any[]; attachments: any[]
  hwSubmissions: any[]; exSubmissions: any[]; exerciseAudio: any[]; generalAudio: any[]
}) {
  const studentTalk = summary?.talk_percentage ?? 40
  const teacherTalk = 100 - studentTalk
  const voiceUrl = lesson.voice_file_url
  const hasProgress = Boolean(summary || voiceUrl || summary?.teacher_note || attachments.length > 0)

  const progressPanel = (
    <>
      {summary && (
        <div className="card p-5" style={{ background: 'linear-gradient(180deg,#ffffff 0%,#f8f7ff 100%)', border: '1px solid rgba(79,70,229,0.16)' }}>
          <h2 className="font-bold text-brand-800 text-base mb-4">📊 Lesson Dashboard</h2>

          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Speaking Balance</p>
              <p className="text-2xl font-extrabold text-brand-600 leading-none mb-1">
                {studentTalk}% / {teacherTalk}%
              </p>
              <div className="space-y-1.5 mt-3">
                {[
                  { label: student.full_name.split(' ')[0], pct: studentTalk, student: true },
                  { label: teacherFirstName, pct: teacherTalk, student: false },
                ].map(({ label, pct, student: isStu }) => (
                  <div key={label} className="grid gap-2" style={{ gridTemplateColumns: '64px 1fr 36px', alignItems: 'center', fontSize: '0.82rem', fontWeight: 700 }}>
                    <span className="text-muted truncate">{label}</span>
                    <div className="h-2 rounded-full bg-indigo-50 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: isStu
                            ? 'linear-gradient(135deg,#7c3aed,#facc15)'
                            : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                        }}
                      />
                    </div>
                    <span className="text-right text-muted">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>

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

            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Grammar Density</p>
              <p className="text-2xl font-extrabold text-brand-600 leading-none">
                {summary.grammar_density || '—'}
              </p>
            </div>
          </div>

          {mainTakeaways && (
            <div className="border-t border-indigo-50 pt-4 mt-1">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Main Corrections &amp; Refinements</p>
              <SectionContent content={mainTakeaways.content} />
            </div>
          )}
        </div>
      )}

      {voiceUrl && (
        <div className="card p-6" style={{ border: '1px solid rgba(79,70,229,0.12)' }}>
          <h2 className="section-title mb-1">🎙️ {teacherFirstName}&rsquo;s Audio Review</h2>
          <audio controls className="w-full" src={voiceUrl} />
        </div>
      )}

      {summary?.teacher_note && (
        <div className="card p-6" style={{ background: 'linear-gradient(180deg,#ffffff,#f7f4ff)', border: '1px solid rgba(79,70,229,0.12)' }}>
          <h2 className="section-title mb-3">🌟 {teacherFirstName}&rsquo;s Note</h2>
          <p className="text-sm text-ink/85 leading-relaxed">{summary.teacher_note}</p>
        </div>
      )}

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

  const homeworkPanel = (
    <>
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

      {exercises.length > 0 && lesson.show_exercises !== false && (
        <LessonExercises
          lessonId={lesson.id}
          studentId={student.id}
          exercises={exercises as any}
          submissions={exSubmissions as any}
          audioSubmissions={exerciseAudio as any}
        />
      )}

      {homework.length > 0 && (
        <HomeworkSubmitSection
          lessonId={lesson.id}
          studentId={student.id}
          initialSubmissions={hwSubmissions}
        />
      )}

      <StudentAudioSubmit
        lessonId={lesson.id}
        studentId={student.id}
        initialSubmissions={generalAudio}
      />
    </>
  )

  const vocabPanel = vocab.length > 0 ? (
    <div className="card p-6">
      <h2 className="section-title mb-1">📖 Key Vocabulary</h2>
      <p className="text-xs text-muted mb-4">Showing {vocab.length} key vocabulary items from this lesson.</p>
      <div className="space-y-3">
        {vocab.map((v: any) => (
          <div key={v.id} className="rounded-xl border border-indigo-50 bg-[#f8f7ff] p-4">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="font-bold text-brand-800 text-base">{v.word}</span>
              {v.jlpt_level && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    background: (JLPT_COLORS[v.jlpt_level] ?? '#818cf8') + '22',
                    color: JLPT_COLORS[v.jlpt_level] ?? '#818cf8',
                    border: `1px solid ${(JLPT_COLORS[v.jlpt_level] ?? '#818cf8')}40`,
                  }}
                >
                  {JLPT_LABELS[v.jlpt_level] ?? v.jlpt_level}
                </span>
              )}
            </div>
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

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      <Link href="/student/dashboard" className="btn-ghost text-xs -ml-1 inline-flex mt-2">
        <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
      </Link>

      <div className="card p-7" style={{ background: 'linear-gradient(180deg,#ffffff 0%,#f7f4ff 100%)' }}>
        <div className="inline-flex items-center gap-2 mb-4 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-brand-600 text-sm font-bold">
          <span className="w-2 h-2 rounded-full bg-brand-600 inline-block" />
          Lesson Recap
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-ink leading-tight mb-1">
          {lesson.title || `Lesson ${lesson.lesson_number}`}
        </h1>
        <p className="text-sm text-muted mb-5">
          🇯🇵 Japanese Lesson Recap: {student.full_name} &amp; {teacherFirstName}
        </p>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Student', value: student.full_name },
            { label: 'Lesson Number', value: `Lesson ${lesson.lesson_number}` },
            { label: 'Date', value: formatDateShort(lesson.lesson_date) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">{label}</p>
              <p className="font-bold text-ink text-sm">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <LessonTabs
        tabs={[
          { id: 'progress', label: 'Progress', icon: '📊', content: progressPanel },
          { id: 'lesson', label: 'Lesson', icon: '📚', content: lessonPanel },
          { id: 'homework', label: 'Homework', icon: '📝', content: homeworkPanel },
          { id: 'vocab', label: 'Vocabulary', icon: '📖', content: vocabPanel },
        ]}
      />

      <div className="flex justify-center pt-2">
        <Link href="/student/dashboard" className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
