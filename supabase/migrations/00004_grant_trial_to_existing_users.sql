-- Grant 5-day trial to all existing users who don't have an active trial
UPDATE profiles 
SET trial_ends_at = now() + interval '5 days'
WHERE trial_ends_at IS NULL OR trial_ends_at < now();