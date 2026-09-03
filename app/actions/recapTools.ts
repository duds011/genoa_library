'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { translateRecap } from '@/lib/recap/openai'
import { buildRecap } from '@/lib/recapShape'
import { noteFromLesson } from '@/lib/lessonNote'

type Result = { success: boolean; error?: string }

/** The teacher who owns this lesson, or nothing. */
async function authorizeLesson(lessonId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' as const }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, teacher_id, student_id, lesson_date, title, status')
    .eq('id', lessonId)
    .eq('teacher_id', user.id)
    .maybeSingle()
  if (!lesson) return { error: 'Lesson not found' as const }
  return { supabase, userId: user.id, lesson }
}

/**
 * Write this lesson into her own Notes grid, once.
 *
 * Her Notes tab is the month view she uses to answer "where did we leave off
 * with this one?", and until now every row in it was typed by hand after the
 * lesson — which is exactly the moment a teacher has least appetite for
 * admin. Publishing a recap already knows the answer, so it fills the cell.
 *
 * Written once and never rewritten. A cell she has already put something in
 * is hers, and republishing an edited recap must not overwrite her words with
 * ours. That is what makes this safe to call on every publish, repeats
 * included.
 *
 * Nothing here can fail a publish. A missing note is a small loss; a lesson
 * that refuses to publish because of one is a much larger one.
 */
export async function writeLessonNote(lessonId: string): Promise<Result> {
  try {
    const auth = await authorizeLesson(lessonId)
    if ('error' in auth) return { success: false, error: auth.error }
    const { lesson } = auth
    if (!lesson.student_id || !lesson.lesson_date) return { success: true }

    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('student_notes')
      .select('id')
      .eq('teacher_id', lesson.teacher_id)
      .eq('student_id', lesson.student_id)
      .eq('note_date', lesson.lesson_date)
      .maybeSingle()
    if (existing) return { success: true }

    const { data: sections } = await admin
      .from('lesson_sections')
      .select('title, sort_order')
      .eq('lesson_id', lessonId)
      .order('sort_order')

    const content = noteFromLesson(lesson.title, (sections ?? []).map((s) => s.title))
    if (!content) return { success: true }

    const { error } = await admin.from('student_notes').insert({
      teacher_id: lesson.teacher_id,
      student_id: lesson.student_id,
      content,
      note_date: lesson.lesson_date,
      pinned: false,
    })
    if (error) console.error('[note] could not write the lesson note:', error.message)

    revalidatePath('/teacher/notes')
    return { success: true }
  } catch (e: any) {
    console.error('[note] could not write the lesson note:', e?.message || e)
    return { success: true }
  }
}

/**
 * Rewrite every explanation in a recap into another language.
 *
 * The lesson material itself — the Japanese, the quotes of what the student
 * actually said, the readings — is left exactly as it is. Only the prose
 * around it moves: the summary, the notes, the definitions, the reasons a
 * correction is a correction.
 *
 * Updated in place, row by row, matched on sort order. The obvious
 * implementation is to delete the children and write the translated ones
 * back, and that would quietly destroy any answer a student had already given
 * against an exercise id.
 */
export async function translateLessonExplanations(
  lessonId: string,
  native: string,
): Promise<Result> {
  const auth = await authorizeLesson(lessonId)
  if ('error' in auth) return { success: false, error: auth.error }
  const { lesson } = auth

  if (!process.env.OPENAI_API_KEY) {
    return { success: false, error: 'Translation is not configured on this server.' }
  }

  try {
    const admin = createAdminClient()
    const [{ data: summary }, { data: sections }, { data: vocab }, { data: homework }] = await Promise.all([
      admin.from('lesson_summaries').select('*').eq('lesson_id', lessonId).maybeSingle(),
      admin.from('lesson_sections').select('*').eq('lesson_id', lessonId).order('sort_order'),
      admin.from('vocabulary_items').select('*').eq('lesson_id', lessonId).order('sort_order'),
      admin.from('homework_items').select('*').eq('lesson_id', lessonId).order('sort_order'),
    ])

    const before = buildRecap({
      lesson,
      summary,
      sections: sections ?? [],
      vocabulary: vocab ?? [],
      homework: homework ?? [],
    })

    const after: any = await translateRecap(before as any, { native, target: 'Japanese' })

    /**
     * Length-checked before anything is written. The model is asked to return
     * the same arrays with the same lengths; when it does not, the safe move
     * is to leave the lesson alone rather than pair a translated sentence with
     * the wrong row.
     */
    const sameLength = (a: unknown[], b: unknown[]) => Array.isArray(b) && b.length === a.length
    const canSections = sameLength(sections ?? [], after.sections)
    const canVocab = sameLength(vocab ?? [], after.vocabulary)
    const canHomework = sameLength(homework ?? [], after.homework)

    const writes: PromiseLike<any>[] = []

    if (after.lesson_title) {
      writes.push(admin.from('lessons').update({ title: String(after.lesson_title) }).eq('id', lessonId))
    }
    writes.push(admin.from('lesson_summaries').update({
      recap: after.recap ?? summary?.recap ?? null,
      teacher_note: after.teacher_note ?? summary?.teacher_note ?? null,
      updated_at: new Date().toISOString(),
    }).eq('lesson_id', lessonId))

    if (canSections) {
      (sections ?? []).forEach((row, i) => {
        const t = after.sections[i]
        writes.push(admin.from('lesson_sections').update({
          title: String(t?.title ?? row.title),
          content: String(t?.content ?? row.content),
        }).eq('id', row.id))
      })
    }
    if (canVocab) {
      (vocab ?? []).forEach((row, i) => {
        const t = after.vocabulary[i]
        // The word and its reading are the material — never touched.
        writes.push(admin.from('vocabulary_items').update({
          definition: t?.definition ?? row.definition,
        }).eq('id', row.id))
      })
    }
    if (canHomework) {
      (homework ?? []).forEach((row, i) => {
        const t = after.homework[i]
        writes.push(admin.from('homework_items').update({
          description: String(t?.description ?? row.description),
        }).eq('id', row.id))
      })
    }

    await Promise.all(writes)
    revalidatePath(`/teacher/lessons/${lessonId}/edit`)

    const skipped = [!canSections && 'sections', !canVocab && 'vocabulary', !canHomework && 'homework']
      .filter(Boolean)
    if (skipped.length) {
      return {
        success: true,
        error: `Translated, but ${skipped.join(' and ')} came back a different length and were left as they were.`,
      }
    }
    return { success: true }
  } catch (e: any) {
    console.error('[translate] failed:', e?.message || e)
    return { success: false, error: 'The translation did not come back. Nothing was changed — try again.' }
  }
}
