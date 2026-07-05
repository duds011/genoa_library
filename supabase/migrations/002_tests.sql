-- ─────────────────────────────────────────────────────────────────────────────
-- Tests / Evaluations — AI-built tests covering a student's lessons
-- Run this in your Supabase SQL Editor after 001_initial.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- A test belongs to one student and is built (by AI) from one or more of that
-- student's lessons. Created as a draft; the teacher reviews then publishes.
CREATE TABLE tests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  teacher_id        UUID REFERENCES auth.users(id) NOT NULL,
  title             TEXT NOT NULL DEFAULT 'Progress Test',
  instructions      TEXT,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  duration_minutes  INTEGER NOT NULL DEFAULT 45,
  lesson_numbers    INTEGER[] DEFAULT '{}',   -- lessons this test covers (for display)
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER tests_updated_at
  BEFORE UPDATE ON tests
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- One question of the test. `data` holds type-specific fields:
--   written    -> { context?, reference_answer?, guidance? }
--   speak      -> { prompt_jp?, prompt_en?, hint? }
--   read_aloud -> { focus?, sentences: [{ jp, en }] }
CREATE TABLE test_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id     UUID REFERENCES tests(id) ON DELETE CASCADE NOT NULL,
  section     TEXT NOT NULL DEFAULT 'general',  -- speaking | reading | grammar
  type        TEXT NOT NULL CHECK (type IN ('written', 'speak', 'read_aloud', 'reading_passage', 'multiple_choice', 'fill_blank')),
  prompt      TEXT NOT NULL,
  data        JSONB DEFAULT '{}'::jsonb,
  points      INTEGER DEFAULT 1,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- One student's answer to one question. Written answers use answer_text;
-- speaking answers use audio_url (uploaded to the `student-audio` bucket).
-- Teacher grades each answer manually (score + feedback).
CREATE TABLE test_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id          UUID REFERENCES tests(id) ON DELETE CASCADE NOT NULL,
  question_id      UUID REFERENCES test_questions(id) ON DELETE CASCADE NOT NULL,
  student_id       UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  answer_text      TEXT,
  audio_url        TEXT,
  file_name        TEXT,
  teacher_feedback TEXT,
  score            NUMERIC(5,1),
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (question_id, student_id)
);

CREATE TRIGGER test_submissions_updated_at
  BEFORE UPDATE ON test_submissions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- One attempt per student per test — tracks the 45-minute timer window.
CREATE TABLE test_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id       UUID REFERENCES tests(id) ON DELETE CASCADE NOT NULL,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  submitted_at  TIMESTAMPTZ,
  UNIQUE (test_id, student_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security  (mirrors the lessons / exercises pattern)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts    ENABLE ROW LEVEL SECURITY;

-- Tests: teacher manages all their own; student sees only published tests of theirs
CREATE POLICY "tests_teacher" ON tests FOR ALL
  USING (teacher_id = auth.uid());
CREATE POLICY "tests_student_published" ON tests FOR SELECT
  USING (
    status = 'published'
    AND student_id IN (SELECT id FROM students WHERE profile_id = auth.uid())
  );

-- Test questions: teacher manages all; student reads questions of published own tests
CREATE POLICY "test_questions_teacher" ON test_questions FOR ALL
  USING (test_id IN (SELECT id FROM tests WHERE teacher_id = auth.uid()));
CREATE POLICY "test_questions_student" ON test_questions FOR SELECT
  USING (
    test_id IN (
      SELECT t.id FROM tests t
      JOIN students s ON t.student_id = s.id
      WHERE t.status = 'published' AND s.profile_id = auth.uid()
    )
  );

-- Test submissions: teacher reads/grades all their tests' submissions;
-- student reads and writes only their own.
CREATE POLICY "test_sub_teacher" ON test_submissions FOR ALL
  USING (test_id IN (SELECT id FROM tests WHERE teacher_id = auth.uid()));
CREATE POLICY "test_sub_student_select" ON test_submissions FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE profile_id = auth.uid()));
CREATE POLICY "test_sub_student_insert" ON test_submissions FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE profile_id = auth.uid()));
CREATE POLICY "test_sub_student_update" ON test_submissions FOR UPDATE
  USING (student_id IN (SELECT id FROM students WHERE profile_id = auth.uid()));

-- Test attempts: teacher reads; student manages their own.
CREATE POLICY "test_attempt_teacher" ON test_attempts FOR SELECT
  USING (test_id IN (SELECT id FROM tests WHERE teacher_id = auth.uid()));
CREATE POLICY "test_attempt_student_select" ON test_attempts FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE profile_id = auth.uid()));
CREATE POLICY "test_attempt_student_insert" ON test_attempts FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE profile_id = auth.uid()));
CREATE POLICY "test_attempt_student_update" ON test_attempts FOR UPDATE
  USING (student_id IN (SELECT id FROM students WHERE profile_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_tests_student        ON tests(student_id);
CREATE INDEX idx_tests_teacher        ON tests(teacher_id);
CREATE INDEX idx_test_questions_test  ON test_questions(test_id);
CREATE INDEX idx_test_sub_test        ON test_submissions(test_id);
CREATE INDEX idx_test_sub_student     ON test_submissions(student_id);
CREATE INDEX idx_test_attempts_test   ON test_attempts(test_id);
