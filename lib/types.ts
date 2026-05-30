export type UserRole = 'teacher' | 'student'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  email: string
  avatar_url?: string
  created_at: string
}

export interface Student {
  id: string
  profile_id?: string
  teacher_id: string
  full_name: string
  email: string
  level: string
  language: string
  created_at: string
}

export interface Lesson {
  id: string
  student_id: string
  teacher_id: string
  lesson_number: number
  lesson_date: string
  status: 'draft' | 'published'
  raw_transcript?: string
  drive_file_id?: string
  created_at: string
  updated_at: string
  // Joined data
  lesson_summary?: LessonSummary
  vocabulary_items?: VocabularyItem[]
  homework_items?: HomeworkItem[]
  students?: Pick<Student, 'full_name' | 'email' | 'level'>
}

export interface LessonSummary {
  id: string
  lesson_id: string
  recap: string
  score: number
  talk_percentage: number
  teacher_notes?: string
  updated_at: string
}

export interface VocabularyItem {
  id: string
  lesson_id: string
  word: string
  reading?: string
  definition: string
  example_sentence?: string
  sort_order: number
  created_at: string
}

export interface HomeworkItem {
  id: string
  lesson_id: string
  description: string
  completed: boolean
  sort_order: number
  created_at: string
}

export interface StudentWithStats extends Student {
  lesson_count: number
  latest_score?: number
  avg_score?: number
  latest_talk_percentage?: number
  total_vocab_words: number
  draft_count: number
}
