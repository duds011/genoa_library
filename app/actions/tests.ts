'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TestQuestionType } from '@/lib/types'

interface GeneratedQuestion {
  section?: string
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

// Parts are long (a 8-12 sentence passage, 5-6 speaking answers), so the test
// needs more room than the original 45 minutes. Noa can still edit it per test.
const TEST_DURATION_MINUTES = 60

export type TestScript = 'romaji' | 'hiragana' | 'kanji'

export interface BuildTestOptions {
  script: TestScript
  sections: string[]   // any of 'speaking' | 'reading' | 'grammar'
}

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
  const allSections = ['speaking', 'reading', 'grammar']
  const script: TestScript = ['romaji', 'hiragana', 'kanji'].includes(input.options?.script as string)
    ? (input.options!.script)
    : 'hiragana'
  let sections = (input.options?.sections ?? allSections).filter(s => allSections.includes(s))
  if (sections.length === 0) sections = allSections
  const options: BuildTestOptions = { script, sections }

  let generated: GeneratedTest
  try {
    generated = await generateTestWithAI(student, lessons, options)
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
      duration_minutes: TEST_DURATION_MINUTES,
      lesson_numbers: lessonNumbers,
      config: options,
    })
    .select('id')
    .single()

  if (testErr || !test) {
    return { success: false, error: testErr?.message ?? 'Could not save the test.' }
  }

  const validSections = ['speaking', 'reading', 'grammar']
  const rows = generated.questions.map((q, i) => ({
    test_id: test.id,
    section: validSections.includes(q.section ?? '') ? q.section : 'general',
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
  options: BuildTestOptions,
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

  const scriptInstruction = {
    romaji: `SCRIPT — BEGINNER (hiragana + romaji): The student is a beginner still learning to read kana, so EVERY Japanese phrase must be shown in hiragana AND with a full romaji reading so they can read it. Never use kanji.
- For "speak": put the hiragana in "prompt_jp" and its romaji reading in "prompt_romaji".
- For "read_aloud": every sentence object has "jp" (hiragana) AND "romaji".
- For "reading_passage": put the hiragana passage in "text", set "script" to "hiragana", and put the FULL romaji reading of the passage in "romaji".
- For "multiple_choice": put the hiragana question in "question" and its romaji reading in "question_romaji".
- For every "multiple_choice"/"fill_blank" option and answer that contains Japanese, write the hiragana followed by its romaji in parentheses, e.g. がくせい (gakusei).
Always include romaji — never leave a Japanese phrase without its romaji reading.`,
    hiragana: `SCRIPT: Write ALL Japanese in hiragana (use katakana only where a word is normally katakana). Do NOT use kanji and do NOT use rōmaji anywhere. For "reading_passage", set "script" to "hiragana".`,
    kanji: `SCRIPT: Write Japanese using normal hiragana/katakana plus basic kanji. Immediately after each kanji word, give its hiragana reading in parentheses, e.g. 学校(がっこう). Do not use rōmaji. For "reading_passage", set "script" to "hiragana".`,
  }[options.script]

  const sectionSpecs: Record<string, string> = {
    speaking: `"speaking": 5 to 6 substantial questions of type "speak" and/or "read_aloud". Make this part meaty — it should take the student 12-15 minutes.
- Each "read_aloud" carries 5 to 7 full sentences (not words or fragments), long enough to test rhythm and connected speech.
- Each "speak" asks for a real spoken answer of 3 to 5 sentences — describe your day, compare two things, explain why, tell a short story, role-play a conversation turn. Never a one-word answer.
- Include at least two "read_aloud" and at least three "speak" questions.`,
    reading: `"reading": a reading-comprehension block that should take the student 15-20 minutes.
- Start with ONE "reading_passage" question containing a SUBSTANTIAL passage of 8 to 12 sentences (roughly 150-250 Japanese characters) — a connected story or description with a beginning, middle and end, not a list of unrelated sentences.
- Then 5 to 6 "multiple_choice" comprehension questions. Each "question" MUST be a genuine question that the student answers by reading the passage (e.g. "メアリーさんは なんねんせいですか。" = what year student is Mary?, what time, who, how many, where, why). Do NOT just restate a sentence from the passage as the stem — it must be an actual question, ending in か or a question mark. The options are plausible answers to that question. Spread the questions across the whole passage, and make at least one require joining two facts together.
- Then ONE "written" question: a writing task of 3 to 4 sentences responding to the passage.`,
    grammar: `"grammar": 5 to 7 grammar questions of type "multiple_choice" and/or "fill_blank", progressing from easier to harder.`,
  }
  const partsList = options.sections
    .map((s, i) => `PART ${i + 1} — ${sectionSpecs[s]}`)
    .join('\n')
  const sectionOrder = options.sections.join(', then ')

  const user = `Build a ${student.language} progress test for a ${student.level} student named ${student.full_name}.

The test is completable in about ${TEST_DURATION_MINUTES} minutes. Every question has a "section" field. Build ONLY these parts, in this order:
${partsList}

${scriptInstruction}

NO ENGLISH TRANSLATIONS — this is a test, not a study sheet:
- Never translate the Japanese for the student. No "translation" on the passage, no "en" on read_aloud sentences or fill_blank items, no "prompt_en" on speaking questions. Those fields no longer exist — do not emit them.
- The task/prompt line and the reading options may be in English where they instruct rather than translate (e.g. "Read this passage aloud", "Answer in 3-4 sentences").
- Instead, give every question a "hint": ONE short English nudge the student can choose to reveal if they get stuck. A hint points the way — the grammar pattern to use, where in the passage to look, the kind of answer expected. It must NEVER contain the translation or the answer itself.
  Good hint: "Look at the second half of the passage — she says when she arrived." / "Use the ～てから pattern."
  Bad hint: "This says 'Mary is a second-year student'." (translation) or "The answer is B." (gives it away)

Rules:
- Order the questions by section: ${sectionOrder}.
- Only cover material from the lessons below. Progress from easier to harder.
- Make each part as long as its spec asks — a short test is a failed test. Do not pad with filler: every question must test something real from the lessons.

Return ONLY valid JSON (no markdown) matching exactly this shape:
{
  "title": string,
  "instructions": string,          // short instructions for the student, mention it is a ${TEST_DURATION_MINUTES}-minute test and that hints are available if they get stuck
  "questions": [
    {
      "section": "speaking" | "reading" | "grammar",
      "type": "written" | "speak" | "read_aloud" | "reading_passage" | "multiple_choice" | "fill_blank",
      "prompt": string,            // the question / task shown to the student
      "points": number,            // 1-5, harder questions worth more (reading_passage = 0)
      "data": {
        // every type also takes "hint"?: string — a short English nudge, revealed only if the student asks. Never a translation, never the answer.
        // "speak":           { "prompt_jp"?: string, "prompt_romaji"?: string, "hint"?: string }
        // "read_aloud":      { "focus"?: string, "sentences": [ { "jp": string, "romaji"?: string } ], "hint"?: string }
        // "reading_passage": { "text": string, "script": "romaji" | "hiragana", "romaji"?: string }
        // "multiple_choice": { "question": string, "question_romaji"?: string, "options": [string, ...], "answer": number, "hint"?: string }  // answer = index of correct option; question must be a real question
        //   for reading: a comprehension question about the passage; for grammar: a grammar/vocab question
        // "fill_blank":      { "before": string, "after": string, "options": [string, ...], "answer": string, "hint"?: string }
        // "written":         { "context"?: string, "reference_answer": string, "guidance"?: string, "hint"?: string }
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
  const supportedTypes = ['written', 'speak', 'read_aloud', 'reading_passage', 'multiple_choice', 'fill_blank']
  parsed.questions = parsed.questions.filter(
    q => q && supportedTypes.includes(q.type) && typeof q.prompt === 'string',
  )
  if (parsed.questions.length === 0) throw new Error('No usable questions were generated. Try again.')

  parsed.questions.forEach(q => { q.data = stripTranslations(q.data) })

  return parsed
}

// The prompt forbids English translations, but the model still slips one in now
// and then. Drop them here so a translation can never reach the student.
function stripTranslations(data: any): any {
  if (!data || typeof data !== 'object') return data ?? {}
  const { translation, prompt_en, en, ...rest } = data
  if (Array.isArray(rest.sentences)) {
    rest.sentences = rest.sentences.map((s: any) => {
      const { en: _en, ...sentence } = s ?? {}
      return sentence
    })
  }
  return rest
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

  revalidatePath('/student/dashboard')
  revalidatePath(`/student/tests/${testId}`)
  return { success: true }
}
