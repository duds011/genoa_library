'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  buildTestPrompt,
  imagePromptFor,
  stripTranslations,
  testShape,
  FOCUS_MAX,
  ALL_SECTIONS,
  SUPPORTED_TYPES,
  type BuildTestOptions,
  type GeneratedTest,
  type TestScript,
} from '@/lib/testPrompt'
import { notifyStudentTestPublished, notifyTeacherOfSubmission } from '@/app/actions/notifications'

export type { BuildTestOptions, TestScript }

// ─── Teacher: build a test from selected lessons via OpenAI ──────────────────

export async function buildTest(input: {
  studentId: string
  lessonIds: string[]
  options?: BuildTestOptions
}): Promise<{ success: boolean; testId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'teacher') return { success: false, error: 'Unauthorized' }

  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, level, language')
    .eq('id', input.studentId)
    .eq('teacher_id', user.id)
    .single()
  if (!student) return { success: false, error: 'Student not found' }

  if (!input.lessonIds || input.lessonIds.length === 0) {
    return { success: false, error: 'Select at least one lesson to cover.' }
  }

  // Pull the lesson material that will ground the test
  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      id, lesson_number, title,
      lesson_summaries ( recap ),
      lesson_sections ( title, content ),
      vocabulary_items ( word, reading, definition, example_sentence ),
      homework_items ( description )
    `)
    .eq('student_id', input.studentId)
    .eq('teacher_id', user.id)
    .in('id', input.lessonIds)
    .order('lesson_number', { ascending: true })

  if (!lessons || lessons.length === 0) {
    return { success: false, error: 'Could not load the selected lessons.' }
  }

  const lessonNumbers = lessons.map((l: any) => l.lesson_number).filter((n: any) => n != null)

  // Normalise build options (script + which parts to include)
  const allSections = ALL_SECTIONS
  const script: TestScript = ['romaji', 'hiragana', 'kanji'].includes(input.options?.script as string)
    ? (input.options!.script)
    : 'hiragana'
  let sections = (input.options?.sections ?? allSections).filter(s => allSections.includes(s))
  if (sections.length === 0) sections = allSections
  const focus = (input.options?.focus ?? '').trim().slice(0, FOCUS_MAX)
  const options: BuildTestOptions = { script, sections, ...(focus ? { focus } : {}) }
  const shape = testShape(lessons.length)

  let generated: GeneratedTest
  try {
    generated = await generateTestWithAI(student, lessons, options, lessonNumbers)
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'AI generation failed.' }
  }

  // Persist as a draft
  const { data: test, error: testErr } = await supabase
    .from('tests')
    .insert({
      student_id: input.studentId,
      teacher_id: user.id,
      title: generated.title || `Progress Test — Lessons ${lessonNumbers.join(', ')}`,
      instructions: generated.instructions || null,
      status: 'draft',
      duration_minutes: shape.durationMinutes,
      lesson_numbers: lessonNumbers,
      config: options,
    })
    .select('id')
    .single()

  if (testErr || !test) {
    return { success: false, error: testErr?.message ?? 'Could not save the test.' }
  }

  const validSections = ['speaking', 'reading', 'grammar']

  // Illustrated questions are capped here rather than trusted to the prompt:
  // each picture is a slow background job, and the model will happily decide
  // that all nine speaking questions deserve one.
  const MAX_IMAGES = 3
  let imagesQueued = 0

  const rows = generated.questions.map((q, i) => {
    const scene = typeof q.data?.image_scene === 'string' ? q.data.image_scene.trim() : ''
    const wantsImage = scene.length > 0 && imagesQueued < MAX_IMAGES
    if (wantsImage) imagesQueued++

    return {
      test_id: test.id,
      section: validSections.includes(q.section ?? '') ? q.section : 'general',
      type: q.type,
      prompt: q.prompt,
      // Which lesson the question came from rides along in data (no column for
      // it), so Noa can see the test really does span the lessons she picked.
      data: {
        ...(q.data ?? {}),
        ...(lessonNumbers.includes(q.lesson_number as number) ? { lesson_number: q.lesson_number } : {}),
      },
      points: q.points ?? 1,
      sort_order: i,
      image_prompt: wantsImage ? imagePromptFor(scene) : null,
      image_status: wantsImage ? 'pending' : 'none',
    }
  })

  const { error: qErr } = await supabase.from('test_questions').insert(rows)
  if (qErr) {
    await supabase.from('tests').delete().eq('id', test.id)
    return { success: false, error: `Could not save questions: ${qErr.message}` }
  }

  revalidatePath(`/teacher/students/${input.studentId}`)
  return { success: true, testId: test.id }
}

async function generateTestWithAI(
  student: { full_name: string; level: string; language: string },
  lessons: any[],
  options: BuildTestOptions,
  lessonNumbers: number[],
): Promise<GeneratedTest> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')

  const { system, user } = buildTestPrompt({ student, lessons, options, lessonNumbers })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 300)}`)
  }

  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned an empty response.')

  let parsed: GeneratedTest
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('OpenAI returned malformed JSON.')
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('The AI did not return any questions. Try again.')
  }

  parsed.questions = parsed.questions.filter(
    q => q && SUPPORTED_TYPES.includes(q.type) && typeof q.prompt === 'string',
  )
  if (parsed.questions.length === 0) throw new Error('No usable questions were generated. Try again.')

  parsed.questions.forEach(q => { q.data = stripTranslations(q.data) })

  return parsed
}

// ─── Teacher: manage a test ──────────────────────────────────────────────────

export async function setTestStatus(testId: string, status: 'draft' | 'published'): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Read the old status first so the student is only emailed when the test
  // actually goes live, not every time Noa flicks the toggle back and forth.
  const { data: before } = await supabase
    .from('tests').select('status').eq('id', testId).eq('teacher_id', user.id).single()

  const { data: test, error } = await supabase
    .from('tests')
    .update({ status })
    .eq('id', testId)
    .eq('teacher_id', user.id)
    .select('student_id')
    .single()

  if (error) return { success: false, error: error.message }

  if (status === 'published' && before?.status !== 'published') {
    // Not allowed to fail the publish itself.
    await notifyStudentTestPublished(testId).catch(() => {})
  }
  if (test?.student_id) revalidatePath(`/teacher/students/${test.student_id}`)
  revalidatePath(`/teacher/tests/${testId}`)
  return { success: true }
}

export async function deleteTest(testId: string): Promise<{ success: boolean; error?: string; studentId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: test } = await supabase
    .from('tests').select('student_id').eq('id', testId).eq('teacher_id', user.id).single()

  const { error } = await supabase.from('tests').delete().eq('id', testId).eq('teacher_id', user.id)
  if (error) return { success: false, error: error.message }

  if (test?.student_id) revalidatePath(`/teacher/students/${test.student_id}`)
  return { success: true, studentId: test?.student_id }
}

export async function updateTest(input: {
  testId: string
  title: string
  instructions: string
  duration_minutes: number
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('tests')
    .update({
      title: input.title.trim() || 'Progress Test',
      instructions: input.instructions.trim() || null,
      duration_minutes: Math.max(1, Math.round(input.duration_minutes) || 45),
    })
    .eq('id', input.testId)
    .eq('teacher_id', user.id)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/teacher/tests/${input.testId}`)
  return { success: true }
}

// Teacher edits a generated question — prompt, points and the type-specific data.
export async function updateTestQuestion(input: {
  questionId: string
  prompt: string
  points: number
  data: any
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // RLS (test_questions_teacher) restricts updates to the teacher's own tests
  const { error } = await supabase
    .from('test_questions')
    .update({
      prompt: input.prompt.trim(),
      points: Math.max(0, Math.round(input.points) || 0),
      data: input.data ?? {},
    })
    .eq('id', input.questionId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteTestQuestion(questionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  // RLS restricts deletes to the teacher's own tests
  const { error } = await supabase.from('test_questions').delete().eq('id', questionId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function gradeTestAnswer(input: {
  submissionId: string
  score: number | null
  feedback: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('test_submissions')
    .update({
      score: input.score,
      teacher_feedback: input.feedback || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', input.submissionId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ─── Student: take a test ────────────────────────────────────────────────────

export async function startTestAttempt(testId: string): Promise<{ success: boolean; error?: string; startedAt?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: student } = await supabase
    .from('students').select('id').eq('profile_id', user.id).single()
  if (!student) return { success: false, error: 'Student not found' }

  // Reuse an existing (non-submitted) attempt so the timer keeps running across reloads
  const { data: existing } = await supabase
    .from('test_attempts')
    .select('started_at, submitted_at')
    .eq('test_id', testId)
    .eq('student_id', student.id)
    .maybeSingle()

  if (existing) return { success: true, startedAt: existing.started_at }

  const startedAt = new Date().toISOString()
  const { error } = await supabase
    .from('test_attempts')
    .insert({ test_id: testId, student_id: student.id, started_at: startedAt })
  if (error) return { success: false, error: error.message }
  return { success: true, startedAt }
}

export async function saveWrittenAnswer(input: {
  testId: string
  questionId: string
  answerText: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: student } = await supabase
    .from('students').select('id').eq('profile_id', user.id).single()
  if (!student) return { success: false, error: 'Student not found' }

  const { error } = await supabase
    .from('test_submissions')
    .upsert(
      {
        test_id: input.testId,
        question_id: input.questionId,
        student_id: student.id,
        answer_text: input.answerText,
      },
      { onConflict: 'question_id,student_id' },
    )
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Auto-graded questions (multiple_choice / fill_blank). Correctness is computed
// server-side from the stored question so the client can't be trusted to grade.
export async function saveChoiceAnswer(input: {
  testId: string
  questionId: string
  answer: string   // MC: the chosen option index as a string; fill_blank: the chosen option
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: student } = await supabase
    .from('students').select('id').eq('profile_id', user.id).single()
  if (!student) return { success: false, error: 'Student not found' }

  const { data: q } = await supabase
    .from('test_questions').select('type, data, points').eq('id', input.questionId).single()
  if (!q) return { success: false, error: 'Question not found' }

  let correct = false
  if (q.type === 'multiple_choice') {
    correct = Number(input.answer) === Number((q.data as any)?.answer)
  } else if (q.type === 'fill_blank') {
    correct = String(input.answer).trim() === String((q.data as any)?.answer ?? '').trim()
  }
  const score = correct ? (q.points ?? 1) : 0

  const { error } = await supabase
    .from('test_submissions')
    .upsert(
      {
        test_id: input.testId,
        question_id: input.questionId,
        student_id: student.id,
        answer_text: input.answer,
        score,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: 'question_id,student_id' },
    )
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function submitTest(testId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: student } = await supabase
    .from('students').select('id').eq('profile_id', user.id).single()
  if (!student) return { success: false, error: 'Student not found' }

  const { error } = await supabase
    .from('test_attempts')
    .update({ submitted_at: new Date().toISOString() })
    .eq('test_id', testId)
    .eq('student_id', student.id)
  if (error) return { success: false, error: error.message }

  // Tell Noa. Never let a mail failure look like a failed submission.
  await notifyTeacherOfSubmission({ kind: 'test', testId }).catch(() => {})

  revalidatePath('/student/dashboard')
  revalidatePath(`/student/tests/${testId}`)
  return { success: true }
}
