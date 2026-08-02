-- History podium: allows projector to show podium from past sessions
-- Stored on competition_state so projector can read it via existing polling
-- Only one row needs these set (use 'english' row as the carrier)
ALTER TABLE competition_state
  ADD COLUMN IF NOT EXISTS history_podium_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS history_podium_level integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS history_podium_subject text DEFAULT NULL;
