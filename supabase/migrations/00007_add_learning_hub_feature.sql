-- Add Learning Hub fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN learning_hub_addon boolean NOT NULL DEFAULT false,
  ADD COLUMN learning_hub_start_date timestamptz,
  ADD COLUMN learning_hub_renewal_date timestamptz,
  ADD COLUMN plan_renewal_date timestamptz;

-- Video watch progress table
CREATE TABLE public.video_watch_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  video_id text NOT NULL,
  video_title text NOT NULL,
  thumbnail_url text NOT NULL,
  channel_name text NOT NULL,
  watched boolean NOT NULL DEFAULT false,
  watched_at timestamptz,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);

CREATE INDEX idx_video_progress_user_category ON public.video_watch_progress(user_id, category);

-- Learning Hub payments table
CREATE TABLE public.learning_hub_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paystack_reference text UNIQUE NOT NULL,
  amount_kobo integer NOT NULL,
  plan_type text NOT NULL,
  billing_period text NOT NULL CHECK (billing_period IN ('2_months', 'annual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lh_payments_user ON public.learning_hub_payments(user_id);
CREATE INDEX idx_lh_payments_reference ON public.learning_hub_payments(paystack_reference);

-- RLS: video_watch_progress
ALTER TABLE public.video_watch_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress" ON public.video_watch_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON public.video_watch_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON public.video_watch_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- RLS: learning_hub_payments (service role manages inserts/updates via edge functions)
ALTER TABLE public.learning_hub_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments" ON public.learning_hub_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);