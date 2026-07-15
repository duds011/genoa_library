-- ─────────────────────────────────────────────────────────────────────────────
-- First-login tour — new students get a one-time walkthrough of their portal
-- Run this in your Supabase SQL Editor after 002_tests.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- NULL = has never finished the tour, so it plays on their next dashboard load.
-- New rows created by Noa default to NULL, which is what triggers the tour.
ALTER TABLE students ADD COLUMN IF NOT EXISTS tour_completed_at TIMESTAMPTZ;

-- Everyone who already uses the portal knows their way around, so mark them all
-- as done. Only students added from here on will see the tour.
UPDATE students SET tour_completed_at = NOW() WHERE tour_completed_at IS NULL;

-- Students may only SELECT their own row (policy students_self) — they have no
-- UPDATE policy, and adding one would also let them rewrite level and
-- lessons_remaining. This function is the narrow exception: it sets one column
-- on the caller's own row and nothing else.
CREATE OR REPLACE FUNCTION mark_student_tour_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE students
  SET tour_completed_at = NOW()
  WHERE profile_id = auth.uid()
    AND tour_completed_at IS NULL;
$$;

REVOKE ALL ON FUNCTION mark_student_tour_seen() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_student_tour_seen() TO authenticated;
