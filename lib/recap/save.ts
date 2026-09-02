/**
 * Write a generated recap into this portal's tables.
 *
 * The engine ported from Lesson Studio returns ONE object. This portal stores
 * the same information across six tables — lessons, lesson_summaries,
 * lesson_sections, vocabulary_items, homework_items, lesson_exercises — so
 * this is the seam between the two shapes, and the only place that knows both.
 *
 * It lands as a DRAFT, exactly like the n8n pipeline does. Noa reviews every
 * recap before a student sees it, and a new way of making them is not a reason
 * to change that.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { pgSafeJson } from './pg-json'

type Db = ReturnType<typeof createAdminClient>

export type SaveRecapInput = {
  teacherId: string
  studentId: string
  lessonDate: string // YYYY-MM-DD
  recap: any
  transcript: string
  /** Which pipeline made this — 'recorder' for the extension. */
  source?: string
}

export type SaveRecapResult = { lessonId: string; created: boolean }

const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : [])

/** The model writes this JSON; it does not always write it the same way twice. */
const asText = (v: unknown): string =>
  Array.isArray(v) ? v.join('\n') : typeof v === 'string' ? v : ''

export async function saveRecap(input: SaveRecapInput): Promise<SaveRecapResult> {
  const admin = createAdminClient()
  const r = pgSafeJson(input.recap ?? {}) as any

  /**
   * One lesson per student per date.
   *
   * Re-recording the same day replaces that day's recap rather than making a
   * second lesson — the lesson_number trigger assigns numbers in date order,
   * and two rows for one day would renumber everything after it.
   */
  const { data: existing } = await admin
    .from('lessons')
    .select('id')
    .eq('student_id', input.studentId)
    .eq('lesson_date', input.lessonDate)
    .maybeSingle()

  const title = String(r.lesson_title ?? '').trim() || null
  let lessonId = existing?.id as string | undefined
  const created = !lessonId

  if (lessonId) {
    await admin
      .from('lessons')
      .update({
        raw_transcript: input.transcript,
        title,
        source: input.source ?? 'recorder',
        updated_at: new Date().toISOString(),
      })
      .eq('id', lessonId)
  } else {
    const { data, error } = await admin
      .from('lessons')
      .insert({
        student_id: input.studentId,
        teacher_id: input.teacherId,
        lesson_date: input.lessonDate,
        // Draft, always. She reviews before the student sees it.
        status: 'draft',
        raw_transcript: input.transcript,
        title,
        source: input.source ?? 'recorder',
      })
      .select('id')
      .single()
    if (error) throw new Error(`Could not create the lesson: ${error.message}`)
    lessonId = data.id
  }

  const { error: se } = await admin.from('lesson_summaries').upsert(
    {
      lesson_id: lessonId,
      recap: asText(r.recap) || null,
      score: typeof r.score === 'number' ? r.score : null,
      talk_percentage: typeof r.talk_percentage === 'number' ? Math.round(r.talk_percentage) : null,
      grammar_density: r.grammar_density ?? null,
      confidence_label: r.confidence_label ?? null,
      teacher_note: r.teacher_note ?? null,
      audio_script: r.audio_script ?? null,
      vocab_total_count: r.vocab_total_count ?? null,
      vocab_level_distribution: r.vocab_level_distribution ?? null,
      // New with the recorder — the n8n pipeline could not produce these.
      corrections: asArray(r.corrections).length ? asArray(r.corrections) : null,
      did_well: asArray(r.did_well).length ? asArray(r.did_well) : null,
      metrics: r.metrics ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'lesson_id' },
  )
  if (se) throw new Error(`Could not save the recap: ${se.message}`)

  /**
   * The child rows are REPLACED, not appended.
   *
   * Rebuilding a lesson that already has sections must not leave the old ones
   * interleaved with the new — that reads as the recap having doubled.
   */
  await replaceChildren(admin, lessonId!, 'lesson_sections',
    asArray(r.sections).map((s: any, i: number) => ({
      lesson_id: lessonId,
      title: String(s?.title ?? '').trim() || `Section ${i + 1}`,
      content: asText(s?.content),
      sort_order: i,
    })))

  await replaceChildren(admin, lessonId!, 'vocabulary_items',
    asArray(r.vocabulary)
      .filter((v: any) => String(v?.word ?? '').trim())
      .map((v: any, i: number) => ({
        lesson_id: lessonId,
        word: String(v.word).trim(),
        reading: v.reading ? String(v.reading) : null,
        definition: v.definition ? String(v.definition) : null,
        example_sentence: v.example_sentence ? String(v.example_sentence) : null,
        // The engine labels Japanese on the JLPT scale and everything else on
        // CEFR; this column holds whichever it used.
        jlpt_level: v.jlpt_level ? String(v.jlpt_level) : null,
        sort_order: i,
      })))

  await replaceChildren(admin, lessonId!, 'homework_items',
    asArray(r.homework)
      .map((h: any) => (typeof h === 'string' ? h : h?.description))
      .filter((d: any) => String(d ?? '').trim())
      .map((description: string, i: number) => ({
        lesson_id: lessonId,
        description: String(description).trim(),
        completed: false,
        sort_order: i,
      })))

  await replaceChildren(admin, lessonId!, 'lesson_exercises',
    asArray(r.exercises)
      .filter((e: any) => e?.type)
      .map((e: any, i: number) => ({
        lesson_id: lessonId,
        type: String(e.type),
        prompt: String(e.prompt ?? ''),
        data: e.data ?? {},
        sort_order: i,
      })))

  return { lessonId: lessonId!, created }
}

/**
 * Swap a lesson's child rows for a new set.
 *
 * Logged rather than thrown: a recap that lands without its homework is still
 * a recap worth reviewing, and losing the whole build over one child table
 * would cost the teacher the lesson.
 */
async function replaceChildren(admin: Db, lessonId: string, table: string, rows: any[]) {
  const { error: de } = await admin.from(table).delete().eq('lesson_id', lessonId)
  if (de) {
    console.error(`[recap] could not clear ${table}: ${de.message}`)
    return
  }
  if (!rows.length) return
  const { error: ie } = await admin.from(table).insert(rows)
  if (ie) console.error(`[recap] could not write ${table}: ${ie.message}`)
}
