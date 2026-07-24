DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'competition_state' AND column_name = 'projector_theme'
  ) THEN
    ALTER TABLE competition_state ADD COLUMN projector_theme text DEFAULT 'dark';
  END IF;
END $$;
