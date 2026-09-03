/**
 * One lesson, in the shape Lesson Studio's recap components expect.
 *
 * Lesson Studio keeps a whole recap in a single `recap_json` column. This
 * portal has always spread the same information across six tables — the
 * summary, its sections, its words, its homework and its exercises — because
 * Noa edits each of those separately in the lesson editor.
 *
 * So this is the seam: the rows go in, the object those components read comes
 * out. Nothing here queries anything, and nothing else knows both shapes.
 */

export type RecapRows = {
  lesson: { lesson_number?: number | null; lesson_date?: string | null; title?: string | null }
  summary: any
  sections: { title?: string | null; content?: string | null }[]
  vocabulary: {
    word?: string | null; reading?: string | null; definition?: string | null
    example_sentence?: string | null; jlpt_level?: string | null
  }[]
  homework: { description?: string | null }[]
}

const arr = (v: unknown): any[] => (Array.isArray(v) ? v : [])

export function buildRecap({ lesson, summary, sections, vocabulary, homework }: RecapRows) {
  const s = summary ?? {}
  return {
    lesson_title: lesson.title || `Lesson ${lesson.lesson_number ?? ''}`.trim(),
    recap: s.recap ?? null,
    score: typeof s.score === 'number' ? s.score : s.score != null ? Number(s.score) : null,
    talk_percentage: s.talk_percentage ?? null,
    grammar_density: s.grammar_density ?? null,
    confidence_label: s.confidence_label ?? null,
    teacher_note: s.teacher_note ?? null,
    vocab_total_count: s.vocab_total_count ?? null,
    vocab_level_distribution: s.vocab_level_distribution ?? null,
    /** Measured from a recording. Absent on lessons built from a transcript. */
    metrics: s.metrics ?? null,
    corrections: arr(s.corrections),
    did_well: arr(s.did_well),
    sections: sections.map((x) => ({ title: x.title ?? '', content: x.content ?? '' })),
    vocabulary: vocabulary.map((v) => ({
      word: v.word ?? '',
      reading: v.reading ?? '',
      definition: v.definition ?? '',
      example_sentence: v.example_sentence ?? '',
      jlpt_level: v.jlpt_level ?? null,
    })),
    homework: homework.map((h) => ({ description: h.description ?? '' })),
    // Read only for the movement's count; the block itself is injected.
    exercises: [] as any[],
  }
}
