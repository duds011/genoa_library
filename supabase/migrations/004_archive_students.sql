-- Archiving students.
--
-- Until now the only way to get a former student out of the payments grid was
-- to delete them, which also destroyed their lessons, notes and payment
-- history. Archiving hides the student from the working views while leaving
-- every row they're attached to intact — their past payments still count
-- toward revenue, because history should not change when someone stops taking
-- lessons.

alter table students
  add column if not exists archived_at timestamptz;

comment on column students.archived_at is
  'When set, the student is inactive: hidden from the students list, payments grid and notes grid. Their existing payments and lessons still count in all totals.';

-- The grids filter on this every render.
create index if not exists students_teacher_archived_idx
  on students (teacher_id, archived_at);
