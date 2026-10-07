ALTER TABLE public.cover_letters
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS reminder_interval text,
  ADD COLUMN IF NOT EXISTS next_reminder_at timestamptz;

ALTER TABLE public.cover_letters
  DROP CONSTRAINT IF EXISTS cover_letters_reminder_interval_check;

ALTER TABLE public.cover_letters
  ADD CONSTRAINT cover_letters_reminder_interval_check
  CHECK (reminder_interval IS NULL OR reminder_interval IN ('daily', 'every_2_days', 'every_3_days'));

CREATE INDEX IF NOT EXISTS cover_letters_due_reminders_idx
  ON public.cover_letters (next_reminder_at)
  WHERE reminder_interval IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.application_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cover_letter_id uuid NOT NULL REFERENCES public.cover_letters(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  application_status text NOT NULL,
  read_at timestamptz,
  email_attempted_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_notifications_status_check
    CHECK (application_status IN ('Applied', 'In Progress', 'Interview', 'Offer Received', 'Taken'))
);

CREATE INDEX IF NOT EXISTS application_notifications_user_created_idx
  ON public.application_notifications (user_id, created_at DESC);

ALTER TABLE public.application_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their application notifications" ON public.application_notifications;
CREATE POLICY "Users can view their application notifications"
  ON public.application_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can mark their application notifications read" ON public.application_notifications;
CREATE POLICY "Users can mark their application notifications read"
  ON public.application_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.application_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.application_notifications TO authenticated;
GRANT ALL ON public.application_notifications TO service_role;

CREATE OR REPLACE FUNCTION public.claim_due_application_reminders()
RETURNS TABLE (
  notification_id uuid,
  user_id uuid,
  cover_letter_id uuid,
  role_name text,
  application_status text,
  user_email text,
  notification_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.application_notifications
  WHERE created_at < now() - interval '7 days';

  RETURN QUERY
  WITH due AS (
    SELECT
      cl.id,
      cl.user_id,
      COALESCE(
        NULLIF(trim(cl.job_title), ''),
        NULLIF(trim(substring(cl.job_description FROM '(?im)(?:job[[:space:]]*title|position|role)[[:space:]]*(?::|-)[[:space:]]*([^[:cntrl:]]+)')), ''),
        'Application follow-up'
      ) AS role_name,
      cl.application_status,
      cl.reminder_interval,
      p.email
    FROM public.cover_letters cl
    JOIN public.profiles p ON p.id = cl.user_id
    WHERE cl.reminder_interval IS NOT NULL
      AND cl.next_reminder_at IS NOT NULL
      AND cl.next_reminder_at <= now()
    FOR UPDATE OF cl SKIP LOCKED
  ),
  advanced AS (
    UPDATE public.cover_letters cl
    SET next_reminder_at = now() + CASE due.reminder_interval
      WHEN 'daily' THEN interval '1 day'
      WHEN 'every_2_days' THEN interval '2 days'
      WHEN 'every_3_days' THEN interval '3 days'
    END
    FROM due
    WHERE cl.id = due.id
    RETURNING cl.id
  ),
  inserted AS (
    INSERT INTO public.application_notifications (
      user_id, cover_letter_id, role_name, application_status
    )
    SELECT due.user_id, due.id, due.role_name, due.application_status
    FROM due
    JOIN advanced ON advanced.id = due.id
    RETURNING
      public.application_notifications.id,
      public.application_notifications.user_id,
      public.application_notifications.cover_letter_id,
      public.application_notifications.role_name,
      public.application_notifications.application_status,
      public.application_notifications.created_at
  )
  SELECT
    inserted.id,
    inserted.user_id,
    inserted.cover_letter_id,
    inserted.role_name,
    inserted.application_status,
    due.email,
    inserted.created_at
  FROM inserted
  JOIN due ON due.id = inserted.cover_letter_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_application_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_application_reminders() TO service_role;

CREATE OR REPLACE FUNCTION public.claim_pending_reminder_emails()
RETURNS TABLE (
  notification_id uuid,
  user_id uuid,
  cover_letter_id uuid,
  role_name text,
  application_status text,
  user_email text,
  notification_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH pending AS (
    SELECT n.id, n.user_id, n.cover_letter_id, n.role_name, n.application_status, n.created_at, p.email
    FROM public.application_notifications n
    JOIN public.profiles p ON p.id = n.user_id
    WHERE n.email_sent_at IS NULL
      AND n.created_at >= now() - interval '7 days'
      AND (n.email_attempted_at IS NULL OR n.email_attempted_at < now() - interval '5 minutes')
    ORDER BY n.created_at
    FOR UPDATE OF n SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.application_notifications n
    SET email_attempted_at = now()
    FROM pending
    WHERE n.id = pending.id
    RETURNING n.id, n.user_id, n.cover_letter_id, n.role_name, n.application_status, n.created_at
  )
  SELECT claimed.id, claimed.user_id, claimed.cover_letter_id, claimed.role_name,
    claimed.application_status, pending.email, claimed.created_at
  FROM claimed
  JOIN pending ON pending.id = claimed.id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_reminder_emails() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_reminder_emails() TO service_role;
