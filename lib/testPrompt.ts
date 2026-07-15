// Prompt construction for AI-built student tests.
//
// This lives outside app/actions/tests.ts because that file is 'use server',
// which may only export async functions — so nothing there can be exercised
// directly. Keeping the prompt as pure functions here means the shape of a test
// (how long, how many questions, which lessons) can be checked on its own.

import type { TestQuestionType } from '@/lib/types'

export type TestScript = 'romaji' | 'hiragana' | 'kanji'

export interface BuildTestOptions {
  script: TestScript
  sections: string[]   // any of 'speaking' | 'reading' | 'grammar'
  focus?: string       // Noa's free-text steer, e.g. "he wants to order food by phone"
}

export interface GeneratedQuestion {
  section?: string
  type: TestQuestionType
  prompt: string
  points?: number
  lesson_number?: number
  data?: any
}

export interface GeneratedTest {
  title: string
  instructions: string
  questions: GeneratedQuestion[]
}

export const FOCUS_MAX = 500
export const ALL_SECTIONS = ['speaking', 'reading', 'grammar']

/**
 * Wraps a scene description from the test AI in the house style.
 *
 * The style and the no-text rule live here rather than in the test prompt so
 * every image matches, and so the ban can't be forgotten one generation in
 * three. Text is banned outright: image models render Japanese as convincing
 * gibberish, and gibberish inside a Japanese exam is worse than no picture.
 */
export function imagePromptFor(scene: string): string {
  return [
    'A clean, friendly flat vector illustration for a Japanese language exam.',
    `Scene: ${scene.trim()}`,
    'Style: soft indigo and purple palette, warm off-white background, simple rounded shapes,',
    'generous negative space, uncluttered composition, gentle and welcoming.',
    'Every object must be instantly recognisable on its own without any label.',
    'ABSOLUTELY NO text, letters, words, numbers, price tags, signage, labels, captions or writing',
    'of any kind anywhere in the image.',
  ].join(' ')
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)

/**
 * More lessons selected means more material to examine, so the test grows with
 * them instead of being a fixed size. BuildTestButton mirrors this to preview
 * the size before building, so keep the two in step.
 */
export function testShape(lessonCount: number) {
  const n = Math.max(1, lessonCount)
  return {
    perPart: clamp(3 + n, 4, 8),              // questions in each part
    passageSentences: clamp(6 + 2 * n, 8, 16),
    durationMinutes: clamp(30 + 10 * n, 45, 90),
  }
}

export function lessonMaterial(lessons: any[]): string {
  return lessons.map((l: any) => {
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
}

export function buildTestPrompt(input: {
  student: { full_name: string; level: string; language: string }
  lessons: any[]
  options: BuildTestOptions
  lessonNumbers: number[]
}): { system: string; user: string; shape: ReturnType<typeof testShape> } {
  const { student, lessons, options, lessonNumbers } = input
  const shape = testShape(lessons.length)
  const { perPart, passageSentences } = shape

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
    speaking: `"speaking": ${perPart} substantial questions of type "speak" and/or "read_aloud". Make this part meaty.
- Each "read_aloud" carries 5 to 7 full sentences (not words or fragments), long enough to test rhythm and connected speech.
- Each "speak" asks for a real spoken answer of 3 to 5 sentences — describe your day, compare two things, explain why, tell a short story, role-play a conversation turn. Never a one-word answer.
- CRITICAL: a "speak" question must give the student something they can actually say. "prompt_jp" must be a genuine question (ending in か or ？) or an explicit role-play instruction that names the situation and their part in it.
  NEVER put a bare command, request or statement in "prompt_jp" — there is nothing to answer and the student just freezes. WRONG: "あなたのがくせいしょうをみせてください。" (please show your student ID). RIGHT: "なんねんせいですか。" or a role-play like "You are at a shop. Ask how much the watch costs, then ask if they have a cheaper one."
  To test a request form such as ～ください, frame it as a role-play that makes the student produce the request — never as a sentence with nothing to answer.
- Include at least two "read_aloud"; the rest are "speak".`,
    reading: `"reading": a reading-comprehension block.
- Start with ONE "reading_passage" question containing a SUBSTANTIAL passage of about ${passageSentences} sentences — a connected story or description with a beginning, middle and end, not a list of unrelated sentences.
- Then ${perPart} "multiple_choice" comprehension questions. Each "question" MUST be a genuine question that the student answers by reading the passage (e.g. "メアリーさんは なんねんせいですか。" = what year student is Mary?, what time, who, how many, where, why). Do NOT just restate a sentence from the passage as the stem — it must be an actual question, ending in か or a question mark. The options are plausible answers to that question. Spread the questions across the whole passage, and make at least one require joining two facts together.
- Then ONE "written" question: a writing task of 3 to 4 sentences responding to the passage.`,
    grammar: `"grammar": ${perPart} grammar questions of type "multiple_choice" and/or "fill_blank", progressing from easier to harder.`,
  }

  const partsList = options.sections.map((s, i) => `PART ${i + 1} — ${sectionSpecs[s]}`).join('\n')
  const sectionOrder = options.sections.join(', then ')

  // Noa's own steer. It biases the test but must never override the rule that
  // everything comes from the lesson material below.
  const focusInstruction = options.focus
    ? `TEACHER'S FOCUS — the teacher wrote this about what she wants this test to achieve:
"""
${options.focus}
"""
Shape the test around it: choose the situations, vocabulary and tasks from the lessons that serve this goal, and weight the parts toward it (e.g. if the focus is a real-world conversation, make the speaking role-plays that conversation and the passage set in it).
This steers WHICH lesson material you pick and how you frame it — it does NOT license new material. Everything must still come from the lessons below. If the focus asks for something the lessons never covered, get as close as the lessons allow and stay within them. Never invent vocabulary or grammar the student has not studied.`
    : ''

  // Pictures are only worth it where the picture IS the task. "How old are
  // you?" gains nothing from an illustration; "describe this scene" cannot work
  // without one.
  const imageInstruction = `PICTURES — a few questions are illustrated. Add an "image_scene" to "data" ONLY on these:
${options.sections.includes('reading') ? '- The ONE "reading_passage": a scene showing the setting the passage takes place in.\n' : ''}${options.sections.includes('speaking') ? '- EXACTLY 1 or 2 "speak" questions, and no more. Make these picture-description tasks: the student looks at the scene and talks about it (what is there, what it costs, whose it is, what the people are doing). Word the "prompt"/"prompt_jp" so it only makes sense with the picture, e.g. "えに なにが ありますか。" — and the scene must contain what you ask about.\n' : ''}
"image_scene" is a SHORT English description of what to draw — objects, people, setting. Rules:
- Only things from the lessons below. If the lessons covered a shop and prices, draw a shop; do not invent a train station.
- Concrete and countable: name the objects plainly ("a wristwatch, a folded umbrella, a shoulder bag on a shop counter"). The student has to be able to name what they see.
- Describe ONLY the scene. No style, no colours, no "illustration of" — that is added separately.
- NEVER ask for text, signs, price tags, numbers or writing in the scene. The picture must carry meaning through objects alone.
- Every other question must have NO "image_scene".

`

  const coverageInstruction = `COVERAGE — the test must reflect the lessons the teacher picked (${lessonNumbers.join(', ')}):
- Draw on ALL of these lessons, not just the most recent. Every lesson listed must be the source of at least one question.
- Spread the questions roughly evenly across them; later lessons can carry the harder material.
- The reading passage should weave together material from several of the lessons.
- Tag EVERY question with "lesson_number": the lesson it draws from. Use only these numbers: ${lessonNumbers.join(', ')}.`

  const user = `Build a ${student.language} progress test for a ${student.level} student named ${student.full_name}.

The test is completable in about ${shape.durationMinutes} minutes. Every question has a "section" field. Build ONLY these parts, in this order:
${partsList}

${focusInstruction}

${coverageInstruction}

${imageInstruction}
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
  "instructions": string,          // short instructions for the student, mention it is a ${shape.durationMinutes}-minute test and that hints are available if they get stuck
  "questions": [
    {
      "section": "speaking" | "reading" | "grammar",
      "type": "written" | "speak" | "read_aloud" | "reading_passage" | "multiple_choice" | "fill_blank",
      "prompt": string,            // the question / task shown to the student
      "points": number,            // 1-5, harder questions worth more (reading_passage = 0)
      "lesson_number": number,     // which lesson this question draws from — one of: ${lessonNumbers.join(', ')}
      "data": {
        // every type also takes "hint"?: string — a short English nudge, revealed only if the student asks. Never a translation, never the answer.
        // "image_scene"?: string — ONLY on the reading_passage and 1-2 picture-description "speak" questions. See PICTURES above.
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
${lessonMaterial(lessons)}`

  return { system, user, shape }
}

// The prompt forbids English translations, but the model still slips one in now
// and then. Drop them here so a translation can never reach the student.
export function stripTranslations(data: any): any {
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

export const SUPPORTED_TYPES = ['written', 'speak', 'read_aloud', 'reading_passage', 'multiple_choice', 'fill_blank']
