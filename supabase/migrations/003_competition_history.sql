CREATE TABLE IF NOT EXISTS competition_history (
  competition_id  text        PRIMARY KEY,
  round_label     text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE competition_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read"   ON competition_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON competition_history FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO competition_history (competition_id, round_label, created_at)
VALUES ('default', NULL, now())
ON CONFLICT DO NOTHING;
