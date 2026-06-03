-- Create RPC function to decrement generation count
CREATE OR REPLACE FUNCTION decrement_generation_count(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET generation_count = GREATEST(generation_count - 1, 0)
  WHERE id = user_id;
END;
$$;