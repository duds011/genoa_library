'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { appUrl, emailShell, escapeHtml, sendEmail } from '@/lib/email'

type SubmissionKind = 'homework' | 'audio' | 'test'

const KIND_COPY: Record<SubmissionKind, { label: string; subject: (n: string) => string; what: string }> = {
  homework: {
    label: 'Homework',
    subject: n => `${n} submitted homework 📝`,
    what: 'submitted their homework',
  },
  audio: {
    label: 'Audio recording',
    subject: n => `${n} sent a recording 🎙️`,
    what: 'sent you a speaking recording',
  },
  test: {
    label: 'Test',
    subject: n => `${n} finished a test ✅`,
    what: 'finished their test',
  },
}

/**
 * Student → Noa. Called after the student's own insert succeeds, so it must
 * never be the thing that fails the submission — callers fire and forget.
 *
 * The student can only trigger a mail about their own lesson/test: everything
 * is resolved from their session, nothing is taken on trust from the client
 * except which lesson it concerns.
 */
export async function notifyTeacherOfSubmission(input: {
  kind: SubmissionKind
  lessonId?: string
  testId?: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, teacher_id')
    .eq('profile_id', user.id)
    .single()
  if (!student) return { ok: false, error: 'Student not found' }

  const admin = createAdminClient()

  // The teacher's address lives on their profile, which RLS hides from students.
  const { data: teacher } = await admin
    .from('profiles').select('email').eq('id', student.teacher_id).single()
  if (!teacher?.email) return { ok: false, error: 'Teacher email not found' }

  const copy = KIND_COPY[input.kind]
  if (!copy) return { ok: false, error: 'Unknown notification kind' }

  let context = ''
  let url = `${appUrl()}/teacher/students/${student.id}`

  if (input.lessonId) {
    const { data: lesson } = await admin
      .from('lessons').select('lesson_number, student_id').eq('id', input.lessonId).single()
    // Only ever describe a lesson that belongs to this student.
    if (lesson && lesson.student_id === student.id) {
      context = `Lesson ${lesson.lesson_number}`
      url = `${appUrl()}/teacher/lessons/${input.lessonId}/edit`
    }
  } else if (input.testId) {
    const { data: test } = await admin
      .from('tests').select('title, student_id').eq('id', input.testId).single()
    if (test && test.student_id === student.id) {
      context = test.title
      url = `${appUrl()}/teacher/tests/${input.testId}`
    }
  }

  const name = escapeHtml(student.full_name)
  return sendEmail({
    to: teacher.email,
    subject: copy.subject(student.full_name),
    html: emailShell({
      heading: `${name} ${copy.what}`,
      intro: `It's waiting for you in GENOA Library whenever you're ready to review it.`,
      boxLabel: copy.label,
      boxTitle: context ? escapeHtml(context) : copy.label,
      boxSub: name,
      ctaText: 'Review it →',
      ctaUrl: url,
      footerNote: `You get this because ${name} is one of your students.`,
    }),
  })
}

/**
 * Noa → student, when she shares a test. Called from setTestStatus only on the
 * draft → published transition, so re-publishing an already-live test is silent.
 */
export async function notifyStudentTestPublished(testId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient()

  const { data: test } = await admin
    .from('tests')
    .select('title, duration_minutes, lesson_numbers, student_id')
    .eq('id', testId)
    .single()
  if (!test) return { ok: false, error: 'Test not found' }

  const { data: student } = await admin
    .from('students').select('full_name, email').eq('id', test.student_id).single()
  if (!student?.email) return { ok: false, error: 'Student email not found' }

  const firstName = escapeHtml(student.full_name.split(' ')[0])
  const lessons = test.lesson_numbers?.length ? ` • Lessons ${test.lesson_numbers.join(', ')}` : ''

  return sendEmail({
    to: student.email,
    subject: 'Noa sent you a test 📝',
    html: emailShell({
      heading: `Hi ${firstName}! 👋`,
      intro: 'Noa has put together a test for you, built from your own lessons. The timer starts when you open it, so take it when you have a clear run at it.',
      boxLabel: 'New test',
      boxTitle: escapeHtml(test.title),
      boxSub: `⏱️ ${test.duration_minutes} minutes${lessons}`,
      ctaText: 'Start the test →',
      ctaUrl: `${appUrl()}/student/tests/${testId}`,
      footerNote: 'You received this because your teacher shared a test with you.',
    }),
  })
}

/**
 * Noa → student, when she leaves feedback on a speaking recording. Until now
 * that feedback was saved silently and the student was never told it existed.
 */
export async function notifyStudentOfSpeakingFeedback(submissionId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient()

  const { data: sub } = await admin
    .from('student_audio_submissions')
    .select('lesson_id, student_id')
    .eq('id', submissionId)
    .single()
  if (!sub) return { ok: false, error: 'Recording not found' }

  const [{ data: student }, { data: lesson }] = await Promise.all([
    admin.from('students').select('full_name, email').eq('id', sub.student_id).single(),
    admin.from('lessons').select('lesson_number').eq('id', sub.lesson_id).single(),
  ])
  if (!student?.email) return { ok: false, error: 'Student email not found' }

  const firstName = escapeHtml(student.full_name.split(' ')[0])

  return sendEmail({
    to: student.email,
    subject: 'Noa replied to your recording 🎧',
    html: emailShell({
      heading: `Hi ${firstName}! 👋`,
      intro: 'Noa has listened to your speaking recording and left you feedback on it.',
      boxLabel: 'Speaking feedback',
      boxTitle: lesson?.lesson_number ? `Lesson ${lesson.lesson_number}` : 'Your recording',
      ctaText: 'Hear her feedback →',
      ctaUrl: `${appUrl()}/student/lessons/${sub.lesson_id}`,
      footerNote: 'You received this because your teacher replied to your recording.',
    }),
  })
}

/**
 * Noa → student, when she has finished grading and chooses to send results.
 * Deliberately a button rather than automatic: she saves each answer's grade
 * separately, so anything automatic would fire mid-way through her marking.
 */
export async function sendTestResults(testId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data: test } = await supabase
    .from('tests')
    .select('title, student_id')
    .eq('id', testId)
    .eq('teacher_id', user.id)
    .single()
  if (!test) return { ok: false, error: 'Test not found' }

  const admin = createAdminClient()
  const [{ data: student }, { data: questions }, { data: subs }] = await Promise.all([
    admin.from('students').select('full_name, email').eq('id', test.student_id).single(),
    admin.from('test_questions').select('id, type, points').eq('test_id', testId),
    admin.from('test_submissions').select('question_id, score').eq('test_id', testId),
  ])
  if (!student?.email) return { ok: false, error: 'Student email not found' }

  const gradable = (questions ?? []).filter(q => q.type !== 'reading_passage')
  const maxScore = gradable.reduce((sum, q) => sum + (q.points ?? 1), 0)
  const ids = new Set(gradable.map(q => q.id))
  const score = (subs ?? [])
    .filter(s => ids.has(s.question_id) && s.score != null)
    .reduce((sum, s) => sum + Number(s.score), 0)
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

  const firstName = escapeHtml(student.full_name.split(' ')[0])

  return sendEmail({
    to: student.email,
    subject: `Your test results are ready 🎉`,
    html: emailShell({
      heading: `Hi ${firstName}! 👋`,
      intro: 'Noa has finished marking your test. Open it to see her feedback on each answer.',
      boxLabel: 'Your score',
      boxTitle: `${score} / ${maxScore} · ${percent}%`,
      boxSub: escapeHtml(test.title),
      ctaText: 'See your results →',
      ctaUrl: `${appUrl()}/student/tests/${testId}`,
      footerNote: 'You received this because your teacher marked your test.',
    }),
  })
}
