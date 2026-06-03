-- Add DELETE policy to allow users to delete their own cover letters
CREATE POLICY "Users can delete their own cover letters" ON cover_letters
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);