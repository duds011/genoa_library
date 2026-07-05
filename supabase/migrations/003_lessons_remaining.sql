-- ─────────────────────────────────────────────────────────────────────────────
-- Prepaid lessons balance per student
-- Noa sets/tops up `lessons_remaining` manually in the Payments tab; a trigger
-- auto-decrements it as lessons are delivered (and refunds on deletion).
-- NULL means the student is not being tracked, so the trigger leaves it alone.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE students ADD COLUMN IF NOT EXISTS lessons_remaining INTEGER;

CREATE OR REPLACE FUNCTION adjust_lessons_remaining()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE students SET lessons_remaining = lessons_remaining - 1
      WHERE id = NEW.student_id AND lessons_remaining IS NOT NULL;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE students SET lessons_remaining = lessons_remaining + 1
      WHERE id = OLD.student_id AND lessons_remaining IS NOT NULL;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS lessons_adjust_remaining ON lessons;
CREATE TRIGGER lessons_adjust_remaining
  AFTER INSERT OR DELETE ON lessons
  FOR EACH ROW EXECUTE PROCEDURE adjust_lessons_remaining();
