-- ─────────────────────────────────────────────────────────────────────────────
-- Language Teacher Portal — Initial Schema
-- Run this in your Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Profiles: extends auth.users with role info
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  full_name   TEXT,
  email       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Students
CREATE TABLE students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES auth.users(id),  -- linked on first student login
  teacher_id  UUID REFERENCES auth.users(id) NOT NULL,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  level       TEXT DEFAULT 'Beginner',
  language    TEXT DEFAULT 'Japanese',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Lessons
CREATE TABLE lessons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  teacher_id      UUID REFERENCES auth.users(id) NOT NULL,
  lesson_number   INTEGER,
  lesson_date     DATE NOT NULL,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  raw_transcript  TEXT,
  drive_file_id   TEXT UNIQUE,  -- prevents double-processing from n8n
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-assign lesson_number per student (1, 2, 3…)
CREATE OR REPLACE FUNCTION assign_lesson_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lesson_number IS NULL THEN
    SELECT COALESCE(MAX(lesson_number), 0) + 1
    INTO NEW.lesson_number
    FROM lessons
    WHERE student_id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_lesson_insert
  BEFORE INSERT ON lessons
  FOR EACH ROW EXECUTE PROCEDURE assign_lesson_number();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- Lesson summaries (AI-generated + teacher-edited)
CREATE TABLE lesson_summaries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id        UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL UNIQUE,
  recap            TEXT,
  score            NUMERIC(3,1) CHECK (score >= 0 AND score <= 10),
  talk_percentage  INTEGER CHECK (talk_percentage >= 0 AND talk_percentage <= 100),
  teacher_notes    TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Vocabulary items
CREATE TABLE vocabulary_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id        UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  word             TEXT NOT NULL,
  reading          TEXT,
  definition       TEXT,
  example_sentence TEXT,
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Homework items
CREATE TABLE homework_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  completed   BOOLEAN DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Drive processing log (n8n deduplication)
CREATE TABLE drive_processing_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id   TEXT UNIQUE NOT NULL,
  file_name       TEXT,
  student_email   TEXT,
  status          TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message   TEXT,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_processing_log ENABLE ROW LEVEL SECURITY;

-- Profiles: each user sees and edits only their own row
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

-- Students: teacher sees all their students; student sees their own record
CREATE POLICY "students_teacher" ON students FOR ALL
  USING (teacher_id = auth.uid());
CREATE POLICY "students_self" ON students FOR SELECT
  USING (profile_id = auth.uid());

-- Lessons: teacher sees/edits all; student sees only published own lessons
CREATE POLICY "lessons_teacher" ON lessons FOR ALL
  USING (teacher_id = auth.uid());
CREATE POLICY "lessons_student_published" ON lessons FOR SELECT
  USING (
    status = 'published'
    AND student_id IN (
      SELECT id FROM students WHERE profile_id = auth.uid()
    )
  );

-- Lesson summaries: follows lesson policy (via lesson_id)
CREATE POLICY "summaries_teacher" ON lesson_summaries FOR ALL
  USING (
    lesson_id IN (SELECT id FROM lessons WHERE teacher_id = auth.uid())
  );
CREATE POLICY "summaries_student" ON lesson_summaries FOR SELECT
  USING (
    lesson_id IN (
      SELECT l.id FROM lessons l
      JOIN students s ON l.student_id = s.id
      WHERE l.status = 'published' AND s.profile_id = auth.uid()
    )
  );

-- Vocabulary items: same pattern
CREATE POLICY "vocab_teacher" ON vocabulary_items FOR ALL
  USING (
    lesson_id IN (SELECT id FROM lessons WHERE teacher_id = auth.uid())
  );
CREATE POLICY "vocab_student" ON vocabulary_items FOR SELECT
  USING (
    lesson_id IN (
      SELECT l.id FROM lessons l
      JOIN students s ON l.student_id = s.id
      WHERE l.status = 'published' AND s.profile_id = auth.uid()
    )
  );

-- Homework items: same pattern
CREATE POLICY "homework_teacher" ON homework_items FOR ALL
  USING (
    lesson_id IN (SELECT id FROM lessons WHERE teacher_id = auth.uid())
  );
CREATE POLICY "homework_student" ON homework_items FOR SELECT
  USING (
    lesson_id IN (
      SELECT l.id FROM lessons l
      JOIN students s ON l.student_id = s.id
      WHERE l.status = 'published' AND s.profile_id = auth.uid()
    )
  );

-- Drive log: teacher only
CREATE POLICY "drive_log_teacher" ON drive_processing_log FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'teacher')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_students_teacher ON students(teacher_id);
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_lessons_student ON lessons(student_id);
CREATE INDEX idx_lessons_teacher ON lessons(teacher_id);
CREATE INDEX idx_lessons_status ON lessons(status);
CREATE INDEX idx_vocab_lesson ON vocabulary_items(lesson_id);
CREATE INDEX idx_homework_lesson ON homework_items(lesson_id);
