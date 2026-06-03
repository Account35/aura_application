-- Backfill plan_status = 'active' for all paid users whose plan_status is NULL.
-- These are users who subscribed before the plan_status column was added.
UPDATE profiles
SET
  plan_status = 'active',
  learning_hub_plan_status = 'active'
WHERE plan != 'free'
  AND (plan_status IS NULL OR learning_hub_plan_status IS NULL);

-- Also ensure the column DEFAULT is set so future inserts are always safe
ALTER TABLE profiles
  ALTER COLUMN plan_status SET DEFAULT 'active',
  ALTER COLUMN learning_hub_plan_status SET DEFAULT 'active';