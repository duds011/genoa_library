'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TestQuestionType } from '@/lib/types'

interface GeneratedQuestion {
  type: TestQuestionType
  prompt: string
  points?: number
  data?: any
}

interface GeneratedTest {
  title: string
  instructions: string
  questions: GeneratedQuestion[]
}

// ─── Teacher: build a test from selected lessons via OpenAI ──────────────────

export async function buildTest(input: {
  studentId: string
  lessonIds: string[]
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

  let generated: GeneratedTest
  try {
    generated = await generateTestWithAI(student, lessons)
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
      duration_minutes: 45,
      lesson_numbers: lessonNumbers,
    })
    .select('id')
    .single()

  if (testErr || !test) {
    return { success: false, error: testErr?.message ?? 'Could not save the test.' }
  }

  const rows = generated.questions.map((q, i) => ({
    test_id: test.id,
    type: q.type,
    prompt: q.prompt,
    data: q.data ?? {},
    points: q.points ?? 1,
    sort_order: i,
  }))

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
): Promise<GeneratedTest> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')

  const material = lessons.map((l: any) => {
    const vocab = (l.vocabulary_items ?? [])
      .map((v: any) => `- ${v.word}${v.reading ? ` (${v.reading})` : ''}: ${v.definition ?? ''}${v.example_sentence ? ` — e.g. ${v.example_sentence}` : ''}`)
      .join('\n')
    const sections = (l.lesson_sections ?? [])
      .map((s: any) => `  ${s.title ? s.title + ': ' : ''}${s.content ?? ''}`)
      .join('\n')
    return [
      `## Lesson ${l.lesson_number}${l.title ? ` — ${l.title}` : ''}`,
      l.lesson_summaries?.recap ? `Recap: ${l.lesson_summaries.recap}` : '',
      sections ? `Content:\n${sections}` : '',
      vocab ? `Vocabulary:\n${vocab}` : '',
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const system = `You are an expert ${student.language} language examiner. You design fair, well-calibrated progress tests that evaluate a student across the specific lessons they have studied. You only test material that appears in the provided lesson content.`

  const user = `Build a ${student.language} progress test for a ${student.level} student named ${student.full_name}.

The test must:
- Be completable in about 45 minutes.
- Contain 8 to 12 questions total.
- Mix "written" questions (student types their answer) and "speak" questions (student records a spoken answer). Include at least 3 of each. You may include a couple of "read_aloud" questions.
- Progress from easier to harder.
- Only cover material from the lessons below.

Return ONLY valid JSON (no markdown) matching exactly this shape:
{
  "title": string,
  "instructions": string,          // short instructions for the student, mention it is a 45-minute test
  "questions": [
    {
      "type": "written" | "speak" | "read_aloud",
      "prompt": string,            // the question / task shown to the student
      "points": number,            // 1-5, harder questions worth more
      "data": {
        // for "written": { "context"?: string, "reference_answer": string, "guidance"?: string }
        //   reference_answer = a model answer to help the teacher grade.
        // for "speak": { "prompt_jp"?: string, "prompt_en"?: string, "hint"?: string }
        // for "read_aloud": { "focus"?: string, "sentences": [ { "jp": string, "en": string } ] }
      }
    }
  ]
}

Lesson material:
${material}`

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

  // Keep only supported types
  parsed.questions = parsed.questions.filter(
    q => q && ['written', 'speak', 'read_aloud'].includes(q.type) && typeof q.prompt === 'string',
  )
  if (parsed.questions.length === 0) throw new Error('No usable questions were generated. Try again.')

  return parsed
}

// ─── Teacher: manage a test ──────────────────────────────────────────────────

export async function setTestStatus(testId: string, status: 'draft' | 'published'): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: test, error } = await supabase
    .from('tests')
    .update({ status })
    .eq('id', testId)
    .eq('teacher_id', user.id)
    .select('student_id')
    .single()

  if (error) return { success: false, error: error.message }
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

  revalidatePath('/student/dashboard')
  revalidatePath(`/student/tests/${testId}`)
  return { success: true }
}
