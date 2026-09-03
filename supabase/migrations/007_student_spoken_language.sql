-- What a lesson with this student is actually SPOKEN in.
--
-- Not what they are learning — that is `language`, and here it is Japanese for
-- everyone. This is what the hour SOUNDS like, which is a different answer per
-- student: a beginner's lesson is mostly the language teacher and student
-- share, an advanced student's is mostly the target.
--
-- Whisper is told this before it transcribes. Telling it the wrong one does not
-- make it skip that speech — it renders it as fluent nonsense in the language
-- it was promised. The recorder used to ask with a dropdown on every lesson;
-- asking once, on the student, is the same answer without the clicking, and it
-- cannot be left wrong in the middle of a lesson.
--
-- English is the default because it is the language these lessons are explained
-- in, and every existing row gets it. A student whose hour runs mostly in
-- Japanese is switched over on their own page.
alter table students
  add column if not exists spoken_language text not null default 'English';
