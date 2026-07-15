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

export type TestQuestionType =
  | 'written'
  | 'speak'
  | 'read_aloud'
  | 'reading_passage'
  | 'multiple_choice'
  | 'fill_blank'

export type TestSection = 'speaking' | 'reading' | 'grammar' | 'general'

export interface Test {
  id: string
  student_id: string
  teacher_id: string
  title: string
  instructions?: string
  status: 'draft' | 'published'
  duration_minutes: number
  lesson_numbers: number[]
  created_at: string
  updated_at: string
  // Joined data
  test_questions?: TestQuestion[]
}

export interface TestQuestion {
  id: string
  test_id: string
  section: TestSection
  type: TestQuestionType
  prompt: string
  data: any
  points: number
  sort_order: number
  created_at: string
  // Illustrated questions (reading passage + picture-description speaking).
  // The picture is drawn in the background after the draft exists.
  image_prompt?: string | null
  image_url?: string | null
  image_status?: 'none' | 'pending' | 'ready' | 'failed'
}

export interface TestSubmission {
  id: string
  test_id: string
  question_id: string
  student_id: string
  answer_text?: string | null
  audio_url?: string | null
  file_name?: string | null
  teacher_feedback?: string | null
  score?: number | null
  reviewed_at?: string | null
  created_at: string
  updated_at: string
}

export interface TestAttempt {
  id: string
  test_id: string
  student_id: string
  started_at: string
  submitted_at?: string | null
}

export interface StudentWithStats extends Student {
  lesson_count: number
  latest_score?: number
  avg_score?: number
  latest_talk_percentage?: number
  total_vocab_words: number
  draft_count: number
}
