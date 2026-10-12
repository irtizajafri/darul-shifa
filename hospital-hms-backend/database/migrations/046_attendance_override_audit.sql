-- Attendance → All Records edit audit (2026-10-12): who changed an
-- employee's attendance and what it was before.
--
-- attendance_overrides.edited_by — the user who last saved this row.
-- attendance_override_logs       — one entry per save: who, when, the
--   employee/day, and that day's rows before → after (JSON), so an edit
--   (e.g. a deduction waived) can always be traced back.
-- Earlier edits were never recorded, so they show no name.

ALTER TABLE attendance_overrides ADD COLUMN IF NOT EXISTS edited_by TEXT;

CREATE TABLE IF NOT EXISTS attendance_override_logs (
  id         SERIAL PRIMARY KEY,
  emp_code   TEXT NOT NULL,
  date_in    DATE NOT NULL,
  action     TEXT NOT NULL,
  edited_by  TEXT,
  edited_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  before     JSONB,
  after      JSONB
);

CREATE INDEX IF NOT EXISTS idx_attendance_override_logs_emp_date ON attendance_override_logs (emp_code, date_in);
