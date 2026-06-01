-- Competition System Schema
-- Supports ~500 students per subject, venue-based, Supabase free tier

-- ============================================================
-- 1. competition_state
--    One row per subject. Students poll this (anon SELECT).
--    Admin toggles is_unlocked, sets active_level, broadcasts announcements.
-- ============================================================
CREATE TABLE IF NOT EXISTS competition_state (
  id                text        PRIMARY KEY,  -- 'english' | 'math'
  competition_id    text        NOT NULL,     -- e.g. '2026-08-08-finals'
  is_unlocked       boolean     DEFAULT false,
  active_level      int,                      -- null = all levels
  round_label       text,
  duration_seconds  int         DEFAULT 300,  -- 5 minutes
  extra_seconds     int         DEFAULT 0,    -- admin can bump to extend time live
  announcement      text,                     -- broadcast to waiting rooms
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE competition_state ENABLE ROW LEVEL SECURITY;

-- Anon can only read (students poll this)
CREATE POLICY "anon_read_state"
  ON competition_state FOR SELECT
  TO anon
  USING (true);

-- Authenticated admin can update
CREATE POLICY "admin_update_state"
  ON competition_state FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated admin can insert (initial setup)
CREATE POLICY "admin_insert_state"
  ON competition_state FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ============================================================
-- 2. competition_sessions
--    One row per student. All student writes go through Edge Functions.
--    Admin/projector read via Realtime.
-- ============================================================
CREATE TABLE IF NOT EXISTS competition_sessions (
  participant_id    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id    text        NOT NULL,
  participant_code  text        NOT NULL,     -- 8+ char random alphanumeric
  display_id        text,                     -- shown on trophy list / certificates
  name              text,
  school            text,
  country           text,                     -- ISO 3166-1 alpha-2 (e.g. 'th', 'us', 'fr')
  subject           text,
  level             int,
  status            text        DEFAULT 'waiting',  -- waiting | active | completed
  provisional_score int         DEFAULT 0,
  validated_score   int,                      -- official, null until finalized
  questions_answered int        DEFAULT 0,
  time_spent_seconds int        DEFAULT 0,
  ready             boolean     DEFAULT false,
  answers_snapshot  jsonb,                    -- latest synced answers array for recovery
  started_at        timestamptz,
  completed_at      timestamptz,
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (participant_code, competition_id)
);

ALTER TABLE competition_sessions ENABLE ROW LEVEL SECURITY;

-- NO anon access at all — students write only through Edge Functions (service role)
-- Authenticated (admin/projector) can read for the live board
CREATE POLICY "auth_read_sessions"
  ON competition_sessions FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated admin can insert (roster seeding)
CREATE POLICY "admin_insert_sessions"
  ON competition_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated admin can update (reset round, etc.)
CREATE POLICY "admin_update_sessions"
  ON competition_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated admin can delete (cleanup)
CREATE POLICY "admin_delete_sessions"
  ON competition_sessions FOR DELETE
  TO authenticated
  USING (true);

-- Leaderboard index (official results)
CREATE INDEX idx_sessions_leaderboard
  ON competition_sessions (competition_id, subject, level, status, validated_score DESC, time_spent_seconds ASC);

-- Live board index (provisional)
CREATE INDEX idx_sessions_liveboard
  ON competition_sessions (competition_id, subject, level, status, provisional_score DESC, time_spent_seconds ASC);

-- Lookup by participant_code + competition_id (Edge Functions use this)
CREATE INDEX idx_sessions_code_lookup
  ON competition_sessions (participant_code, competition_id);


-- ============================================================
-- 3. answer_keys
--    NEVER readable by any client. Only service role (Edge Functions) reads this.
-- ============================================================
CREATE TABLE IF NOT EXISTS answer_keys (
  question_id     text    NOT NULL,
  subject         text    NOT NULL,
  level           int     NOT NULL,
  correct_answer  text    NOT NULL,
  competition_id  text    NOT NULL,
  PRIMARY KEY (question_id, competition_id)
);

ALTER TABLE answer_keys ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon or authenticated.
-- Only service role (Edge Functions) can read/write.


-- ============================================================
-- 4. submissions (audit trail for disputes)
--    No client access. Written only by Edge Functions.
-- ============================================================
CREATE TABLE IF NOT EXISTS submissions (
  id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  participant_id  uuid        REFERENCES competition_sessions(participant_id) ON DELETE CASCADE,
  question_id     text        NOT NULL,
  submitted_answer text,
  is_correct      boolean,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- No policies = no client access. Only service role writes.

-- Index for looking up a student's submissions
CREATE INDEX idx_submissions_participant
  ON submissions (participant_id);


-- ============================================================
-- 5. Realtime — enable ONLY on competition_sessions
-- ============================================================
-- Note: Run this in the Supabase dashboard or via the API:
--   ALTER PUBLICATION supabase_realtime ADD TABLE competition_sessions;
-- This line is included for documentation; it may need to be run separately
-- depending on your Supabase setup.

DO $$
BEGIN
  -- Add competition_sessions to the realtime publication if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'competition_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE competition_sessions;
  END IF;
END
$$;


-- ============================================================
-- 6. Seed initial competition_state rows
-- ============================================================
INSERT INTO competition_state (id, competition_id, is_unlocked, duration_seconds)
VALUES
  ('english', 'default', false, 300),
  ('math',    'default', false, 600)
ON CONFLICT (id) DO NOTHING;
