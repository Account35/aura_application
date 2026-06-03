
-- ── cancel_subscription RPC ──────────────────────────────────────────────────
-- Updates plan_status or learning_hub_plan_status to 'cancelled' for the
-- currently authenticated user. SECURITY DEFINER ensures the update runs
-- with elevated privileges while auth.uid() scopes it to the caller.
CREATE OR REPLACE FUNCTION cancel_subscription(target_type text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_access_until timestamptz;
  v_plan     text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF target_type = 'plan' THEN
    SELECT plan, plan_renewal_date INTO v_plan, v_access_until
    FROM profiles WHERE id = v_user_id;

    IF v_plan = 'free' THEN
      RETURN json_build_object('success', false, 'error', 'Free plan cannot be cancelled');
    END IF;

    UPDATE profiles
    SET plan_status = 'cancelled', updated_at = now()
    WHERE id = v_user_id;

    RETURN json_build_object('success', true, 'access_until', v_access_until);

  ELSIF target_type = 'learning_hub' THEN
    SELECT learning_hub_renewal_date INTO v_access_until
    FROM profiles WHERE id = v_user_id;

    UPDATE profiles
    SET learning_hub_plan_status = 'cancelled', updated_at = now()
    WHERE id = v_user_id;

    RETURN json_build_object('success', true, 'access_until', v_access_until);

  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid target_type');
  END IF;
END;
$$;

-- ── reinstate_subscription RPC ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reinstate_subscription(target_type text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_renewal_date   timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF target_type = 'plan' THEN
    SELECT plan_renewal_date INTO v_renewal_date
    FROM profiles WHERE id = v_user_id;

    IF v_renewal_date IS NOT NULL AND now() >= v_renewal_date THEN
      RETURN json_build_object('success', false, 'error', 'Access period has ended. Please purchase a new subscription.');
    END IF;

    UPDATE profiles
    SET plan_status = 'active', updated_at = now()
    WHERE id = v_user_id;

    RETURN json_build_object('success', true, 'next_billing_date', v_renewal_date);

  ELSIF target_type = 'learning_hub' THEN
    SELECT learning_hub_renewal_date INTO v_renewal_date
    FROM profiles WHERE id = v_user_id;

    IF v_renewal_date IS NOT NULL AND now() >= v_renewal_date THEN
      RETURN json_build_object('success', false, 'error', 'Learning Hub access period has ended. Please purchase a new add-on.');
    END IF;

    UPDATE profiles
    SET learning_hub_plan_status = 'active', updated_at = now()
    WHERE id = v_user_id;

    RETURN json_build_object('success', true, 'next_billing_date', v_renewal_date);

  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid target_type');
  END IF;
END;
$$;
