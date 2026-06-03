-- Create user plan enum
CREATE TYPE user_plan AS ENUM ('free', 'pro', 'career_accelerator');

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  plan user_plan NOT NULL DEFAULT 'free',
  generation_count int NOT NULL DEFAULT 10,
  generation_reset_date timestamptz NOT NULL DEFAULT date_trunc('month', now() + interval '1 month'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create cover_letters table
CREATE TABLE cover_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  job_description text NOT NULL,
  cv_content text NOT NULL,
  ats_score int,
  ats_reasons text,
  cv_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_letter_id uuid NOT NULL REFERENCES cover_letters(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  reasoning_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_cover_letters_user_id ON cover_letters(user_id);
CREATE INDEX idx_cover_letters_created_at ON cover_letters(created_at DESC);
CREATE INDEX idx_chat_messages_cover_letter_id ON chat_messages(cover_letter_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- Create helper function to check admin status
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.plan = 'career_accelerator'
  );
$$;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Cover letters policies
CREATE POLICY "Users can view their own cover letters" ON cover_letters
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cover letters" ON cover_letters
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Chat messages policies
CREATE POLICY "Users can view chat messages for their cover letters" ON chat_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM cover_letters cl
      WHERE cl.id = chat_messages.cover_letter_id
      AND cl.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert chat messages for their cover letters" ON chat_messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM cover_letters cl
      WHERE cl.id = chat_messages.cover_letter_id
      AND cl.user_id = auth.uid()
    )
  );

-- Create trigger function to sync auth.users to profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, plan, generation_count, generation_reset_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    'free'::user_plan,
    10,
    date_trunc('month', now() + interval '1 month')
  );
  RETURN NEW;
END;
$$;

-- Create trigger to sync users on confirmation
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();

-- Create function to reset generation count monthly
CREATE OR REPLACE FUNCTION reset_generation_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET 
    generation_count = CASE 
      WHEN plan = 'free' THEN 10
      ELSE generation_count
    END,
    generation_reset_date = date_trunc('month', now() + interval '1 month')
  WHERE generation_reset_date <= now() AND plan = 'free';
END;
$$;