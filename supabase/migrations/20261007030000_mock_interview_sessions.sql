ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz;

UPDATE public.profiles
SET plan_started_at = COALESCE(
  (
    SELECT max(payment.completed_at)
    FROM public.learning_hub_payments payment
    WHERE payment.user_id = profiles.id
      AND payment.plan_type = profiles.plan::text
      AND payment.status = 'completed'
      AND payment.completed_at IS NOT NULL
  ),
  created_at
)
WHERE plan <> 'free' AND plan_started_at IS NULL;

CREATE TABLE IF NOT EXISTS public.mock_interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cover_letter_id uuid REFERENCES public.cover_letters(id) ON DELETE SET NULL,
  role_name text NOT NULL,
  company_name text,
  interviewer_name text NOT NULL DEFAULT 'Aur.a AI Interviewer',
  job_description text NOT NULL DEFAULT '',
  cv_summary text NOT NULL DEFAULT '',
  tavus_pal_id text,
  tavus_conversation_id text UNIQUE,
  tavus_conversation_url text,
  tavus_meeting_token text,
  conversation_transcript jsonb,
  status text NOT NULL DEFAULT 'starting',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  feedback_report jsonb,
  feedback_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mock_interview_sessions_status_check
    CHECK (status IN ('starting', 'active', 'ended', 'failed')),
  CONSTRAINT mock_interview_sessions_duration_check
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS mock_interview_sessions_user_started_idx
  ON public.mock_interview_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS mock_interview_sessions_pro_quota_idx
  ON public.mock_interview_sessions (user_id, started_at)
  WHERE status IN ('starting', 'active', 'ended');

ALTER TABLE public.mock_interview_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their mock interview sessions" ON public.mock_interview_sessions;
CREATE POLICY "Users can view their mock interview sessions"
  ON public.mock_interview_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.mock_interview_sessions TO authenticated;
GRANT ALL ON public.mock_interview_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.mock_interview_cycle_start(p_started_at timestamptz, p_now timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_months integer;
  v_month_base timestamptz;
  v_day integer;
  v_cycle_start timestamptz;
BEGIN
  IF p_started_at IS NULL THEN
    RETURN date_trunc('month', p_now);
  END IF;

  v_months := (extract(year FROM p_now)::integer - extract(year FROM p_started_at)::integer) * 12
    + extract(month FROM p_now)::integer - extract(month FROM p_started_at)::integer;
  v_month_base := date_trunc('month', p_started_at) + make_interval(months => v_months);
  v_day := least(
    extract(day FROM p_started_at)::integer,
    extract(day FROM (v_month_base + interval '1 month' - interval '1 day'))::integer
  );
  v_cycle_start := v_month_base + make_interval(days => v_day - 1)
    + (p_started_at - date_trunc('day', p_started_at));

  IF v_cycle_start > p_now THEN
    v_months := greatest(v_months - 1, 0);
    v_month_base := date_trunc('month', p_started_at) + make_interval(months => v_months);
    v_day := least(
      extract(day FROM p_started_at)::integer,
      extract(day FROM (v_month_base + interval '1 month' - interval '1 day'))::integer
    );
    v_cycle_start := v_month_base + make_interval(days => v_day - 1)
      + (p_started_at - date_trunc('day', p_started_at));
  END IF;
  RETURN v_cycle_start;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mock_interview_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_now timestamptz := now();
  v_trial boolean;
  v_paid_access boolean;
  v_cycle_start timestamptz;
  v_used integer := 0;
  v_limit integer;
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_trial := v_profile.trial_ends_at IS NOT NULL AND v_profile.trial_ends_at > v_now;
  v_paid_access := v_profile.plan_status IS DISTINCT FROM 'cancelled'
    OR (v_profile.plan_renewal_date IS NOT NULL AND v_profile.plan_renewal_date > v_now);

  IF v_profile.plan = 'pro' THEN
    v_cycle_start := public.mock_interview_cycle_start(COALESCE(v_profile.plan_started_at, v_profile.created_at), v_now);
    SELECT count(*)::integer INTO v_used FROM public.mock_interview_sessions
      WHERE user_id = v_profile.id AND started_at >= v_cycle_start
        AND status IN ('starting', 'active', 'ended');
    v_limit := 5;
    v_allowed := v_trial OR (v_paid_access AND v_used < v_limit);
  ELSIF v_profile.plan = 'career_accelerator' THEN
    v_limit := NULL;
    v_allowed := v_trial OR v_paid_access;
  ELSE
    v_limit := 0;
    v_allowed := v_trial;
  END IF;

  RETURN jsonb_build_object(
    'plan', v_profile.plan,
    'allowed', v_allowed,
    'is_trial', v_trial,
    'used', v_used,
    'limit', v_limit,
    'remaining', CASE WHEN v_limit IS NULL THEN NULL ELSE greatest(v_limit - v_used, 0) END,
    'period_start', v_cycle_start
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_mock_interview_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mock_interview_usage() TO authenticated;

CREATE OR REPLACE FUNCTION public.reserve_mock_interview_session(
  p_user_id uuid,
  p_role_name text,
  p_company_name text DEFAULT NULL,
  p_cover_letter_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_now timestamptz := now();
  v_trial boolean;
  v_paid_access boolean;
  v_cycle_start timestamptz;
  v_used integer := 0;
  v_allowed boolean;
  v_reason text;
  v_session_id uuid;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF p_cover_letter_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cover_letters WHERE id = p_cover_letter_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  UPDATE public.mock_interview_sessions
    SET status = 'failed', ended_at = v_now
    WHERE user_id = p_user_id AND status = 'starting' AND created_at < v_now - interval '15 minutes';

  v_trial := v_profile.trial_ends_at IS NOT NULL AND v_profile.trial_ends_at > v_now;
  v_paid_access := v_profile.plan_status IS DISTINCT FROM 'cancelled'
    OR (v_profile.plan_renewal_date IS NOT NULL AND v_profile.plan_renewal_date > v_now);

  IF v_profile.plan = 'pro' THEN
    v_cycle_start := public.mock_interview_cycle_start(COALESCE(v_profile.plan_started_at, v_profile.created_at), v_now);
    SELECT count(*)::integer INTO v_used FROM public.mock_interview_sessions
      WHERE user_id = p_user_id AND started_at >= v_cycle_start
        AND status IN ('starting', 'active', 'ended');
    v_allowed := v_trial OR (v_paid_access AND v_used < 5);
    IF NOT v_allowed THEN
      v_reason := CASE WHEN NOT v_trial AND NOT v_paid_access THEN 'plan_required' ELSE 'limit_reached' END;
    END IF;
  ELSIF v_profile.plan = 'career_accelerator' THEN
    v_allowed := v_trial OR v_paid_access;
    IF NOT v_allowed THEN v_reason := 'plan_required'; END IF;
  ELSE
    v_allowed := v_trial;
    IF NOT v_allowed THEN v_reason := 'plan_required'; END IF;
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', v_reason, 'plan', v_profile.plan,
      'used', v_used, 'limit', CASE WHEN v_profile.plan = 'pro' THEN 5 ELSE 0 END,
      'remaining', CASE WHEN v_profile.plan = 'pro' THEN greatest(5 - v_used, 0) ELSE 0 END,
      'period_start', v_cycle_start
    );
  END IF;

  INSERT INTO public.mock_interview_sessions (user_id, role_name, company_name, cover_letter_id)
    VALUES (p_user_id, COALESCE(NULLIF(trim(p_role_name), ''), 'General professional interview'), p_company_name, p_cover_letter_id)
    RETURNING id INTO v_session_id;
  v_used := v_used + 1;

  RETURN jsonb_build_object(
    'allowed', true, 'session_id', v_session_id, 'plan', v_profile.plan,
    'is_trial', v_trial, 'used', v_used,
    'limit', CASE WHEN v_profile.plan = 'pro' AND NOT v_trial THEN 5 ELSE NULL END,
    'remaining', CASE WHEN v_profile.plan = 'pro' AND NOT v_trial THEN greatest(5 - v_used, 0) ELSE NULL END,
    'period_start', v_cycle_start
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_mock_interview_session(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_mock_interview_session(uuid, text, text, uuid) TO service_role;
