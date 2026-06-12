-- Fix: fire handle_new_user on INSERT (email confirmations are disabled)
DROP TRIGGER IF EXISTS "on_auth_user_confirmed" ON "auth"."users";
DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";

CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();
