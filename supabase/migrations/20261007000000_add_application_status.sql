ALTER TABLE public.cover_letters
  ADD COLUMN IF NOT EXISTS application_status text NOT NULL DEFAULT 'Applied';

UPDATE public.cover_letters
SET application_status = 'Applied'
WHERE application_status IS NULL;

ALTER TABLE public.cover_letters
  DROP CONSTRAINT IF EXISTS cover_letters_application_status_check;

ALTER TABLE public.cover_letters
  ADD CONSTRAINT cover_letters_application_status_check
  CHECK (application_status IN ('Applied', 'In Progress', 'Interview', 'Offer Received', 'Taken'));
