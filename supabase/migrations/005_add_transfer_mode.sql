DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'competition_state' AND column_name = 'transfer_mode'
  ) THEN
    ALTER TABLE competition_state ADD COLUMN transfer_mode text DEFAULT 'auto';
  END IF;
END $$;
