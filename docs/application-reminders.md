# Application reminders setup

The reminder processor is `supabase/functions/process-application-reminders`. Deploy the migrations and function, then make sure these Supabase Edge Function secrets are present:

- `EMAILJS_SERVICE_ID`
- `EMAILJS_TEMPLATE_ID`
- `EMAILJS_PUBLIC_KEY`
- `REMINDER_FUNCTION_SECRET` (a long random value used to authorize scheduled calls)
- `APP_URL` (the public Aur.a origin, without a trailing slash)

Supabase also provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.

In the Supabase Dashboard, create a Cron job to POST to `/functions/v1/process-application-reminders` every 15 minutes. Set the `x-reminder-secret` header to the same `REMINDER_FUNCTION_SECRET` value, include the project publishable key in the `apikey` header, and send `{}` as the JSON body. This runs reminders while the user is away; each run also clears in-app reminders older than seven days and retries any reminder emails that have not succeeded.

The EmailJS template should use these dynamic template parameters:

- `to_email`
- `role_name`
- `application_status`
- `update_url`
- `login_url`
- `call_to_action`
