-- Add trial period column to profiles
ALTER TABLE profiles ADD COLUMN trial_ends_at timestamptz;

-- Update existing users to have no trial (already past)
UPDATE profiles SET trial_ends_at = now() - interval '1 day';

-- Update the trigger function to give new users a 5-day trial
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, plan, generation_count, generation_reset_date, trial_ends_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    'free'::user_plan,
    10,
    date_trunc('month', now() + interval '1 month'),
    now() + interval '5 days'
  );
  RETURN NEW;
END;
$$;