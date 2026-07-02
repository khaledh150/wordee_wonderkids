-- Add started_at and theme columns to competition_state if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'competition_state' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE competition_state ADD COLUMN started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'competition_state' AND column_name = 'theme'
  ) THEN
    ALTER TABLE competition_state ADD COLUMN theme text DEFAULT 'dark';
  END IF;
END $$;
