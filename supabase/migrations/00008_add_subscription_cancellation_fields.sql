-- Add plan_status to track active/cancelled state independently of plan tier
ALTER TABLE profiles
  ADD COLUMN plan_status text NOT NULL DEFAULT 'active'
    CHECK (plan_status IN ('active', 'cancelled')),
  ADD COLUMN paystack_subscription_code text NULL,
  ADD COLUMN learning_hub_plan_status text NOT NULL DEFAULT 'active'
    CHECK (learning_hub_plan_status IN ('active', 'cancelled')),
  ADD COLUMN learning_hub_subscription_code text NULL;

COMMENT ON COLUMN profiles.plan_status IS 'active = auto-renews; cancelled = no renewal but access until plan_renewal_date';
COMMENT ON COLUMN profiles.paystack_subscription_code IS 'Paystack subscription code for base plan recurring billing management';
COMMENT ON COLUMN profiles.learning_hub_plan_status IS 'active = auto-renews; cancelled = no renewal but access until learning_hub_renewal_date';
COMMENT ON COLUMN profiles.learning_hub_subscription_code IS 'Paystack subscription code for Learning Hub add-on recurring billing management';