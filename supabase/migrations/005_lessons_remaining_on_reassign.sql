-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: prepaid balance didn't move when a lesson was assigned to a student
-- AFTER it was created.
--
-- The old trigger only fired on INSERT and DELETE. But recaps that can't be
-- matched land unassigned (student_id NULL), so the INSERT decrements nobody;
-- when Noa later links the lesson to the student — in the lesson editor, or by
-- us fixing it — that's an UPDATE, which the trigger ignored. The balance never
-- went down. This is exactly what happened to Andy Karcev and Andy Rapacke.
--
-- Now the trigger also handles UPDATE, but only when student_id actually
-- changes (the editor writes student_id on every save, so a plain edit must not
-- move the balance):
--   NULL -> student   : deliver, decrement the new student
--   student -> NULL    : unassign, refund the old student
--   studentA -> studentB : refund A, charge B
-- NULL lessons_remaining still means "not tracked" and is left alone throughout.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION adjust_lessons_remaining()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.student_id IS NOT NULL THEN
      UPDATE students SET lessons_remaining = lessons_remaining - 1
        WHERE id = NEW.student_id AND lessons_remaining IS NOT NULL;
    END IF;
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.student_id IS NOT NULL THEN
      UPDATE students SET lessons_remaining = lessons_remaining + 1
        WHERE id = OLD.student_id AND lessons_remaining IS NOT NULL;
    END IF;
    RETURN OLD;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Only react when the assignment itself changes.
    IF OLD.student_id IS DISTINCT FROM NEW.student_id THEN
      IF OLD.student_id IS NOT NULL THEN
        UPDATE students SET lessons_remaining = lessons_remaining + 1
          WHERE id = OLD.student_id AND lessons_remaining IS NOT NULL;
      END IF;
      IF NEW.student_id IS NOT NULL THEN
        UPDATE students SET lessons_remaining = lessons_remaining - 1
          WHERE id = NEW.student_id AND lessons_remaining IS NOT NULL;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS lessons_adjust_remaining ON lessons;
CREATE TRIGGER lessons_adjust_remaining
  AFTER INSERT OR UPDATE OR DELETE ON lessons
  FOR EACH ROW EXECUTE PROCEDURE adjust_lessons_remaining();
