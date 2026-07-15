import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function scoreDelta(current: number, previous?: number): string {
  if (previous === undefined) return '+0.0 since lesson 1'
  const delta = current - previous
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)} since lesson 1`
}

export function getLevelLabel(lessonCount: number): string {
  if (lessonCount < 5) return 'Getting Started'
  if (lessonCount < 10) return 'Beginner'
  if (lessonCount < 25) return 'Elementary'
  if (lessonCount < 50) return 'Intermediate'
  return 'Advanced'
}

// Test parts, in display order. Unknown sections fall back to "Other".
export const TEST_SECTIONS: { key: string; part: string; title: string }[] = [
  { key: 'speaking', part: 'Part 1', title: 'Speaking' },
  { key: 'reading',  part: 'Part 2', title: 'Reading & Writing' },
  { key: 'grammar',  part: 'Part 3', title: 'Grammar' },
  { key: 'general',  part: '',       title: 'Other' },
]

// Group questions into their sections, preserving section order + sort_order.
export function groupBySection<T extends { section?: string; sort_order: number }>(
  questions: T[],
): { key: string; part: string; title: string; items: T[] }[] {
  return TEST_SECTIONS
    .map(s => ({
      ...s,
      items: questions
        .filter(q => (q.section ?? 'general') === s.key || (s.key === 'general' && !TEST_SECTIONS.some(x => x.key === (q.section ?? 'general'))))
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter(s => s.items.length > 0)
}

// Roll a student's answers up into one test score. Reading passages are display
// -only so they never count toward the total. `awaiting` is the number of
// answered questions the teacher still has to grade by hand (speaking/written);
// until it hits zero, `score` is only the part graded so far.
export function testScore(
  questions: { id: string; type: string; points?: number | null }[],
  submissions: { question_id: string; score?: number | null }[],
): { score: number; maxScore: number; percent: number; graded: number; awaiting: number; gradable: number } {
  const gradable = questions.filter(q => q.type !== 'reading_passage')
  const maxScore = gradable.reduce((sum, q) => sum + (q.points ?? 1), 0)

  const gradableIds = new Set(gradable.map(q => q.id))
  const answers = submissions.filter(s => gradableIds.has(s.question_id))
  const graded = answers.filter(s => s.score != null)
  const score = graded.reduce((sum, s) => sum + Number(s.score), 0)

  return {
    score,
    maxScore,
    percent: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    graded: graded.length,
    awaiting: answers.length - graded.length,
    gradable: gradable.length,
  }
}

export function getLevelEmoji(lessonCount: number): string {
  if (lessonCount < 5) return '🌱'
  if (lessonCount < 10) return '🌸'
  if (lessonCount < 25) return '🌿'
  if (lessonCount < 50) return '⭐'
  return '🏆'
}
