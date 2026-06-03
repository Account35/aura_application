CREATE TABLE personalised_cvs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     text NOT NULL,
  job_title   text NOT NULL DEFAULT '',
  job_description text NOT NULL DEFAULT '',
  cv_content  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: users can only read/write their own rows
ALTER TABLE personalised_cvs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own personalised CVs"
  ON personalised_cvs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own personalised CVs"
  ON personalised_cvs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own personalised CVs"
  ON personalised_cvs FOR DELETE
  USING (auth.uid() = user_id);

-- Index for history queries
CREATE INDEX idx_personalised_cvs_user_created
  ON personalised_cvs (user_id, created_at DESC);