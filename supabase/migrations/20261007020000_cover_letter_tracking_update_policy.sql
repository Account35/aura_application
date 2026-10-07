-- Allow signed-in users to update only their own cover-letter tracking fields.
DROP POLICY IF EXISTS "Users can update their own cover letter tracking" ON public.cover_letters;
CREATE POLICY "Users can update their own cover letter tracking"
  ON public.cover_letters FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT UPDATE (application_status, reminder_interval, next_reminder_at)
  ON public.cover_letters TO authenticated;
