# Mock interview deployment setup

Run the database migration `20261007030000_mock_interview_sessions.sql` after the application status/reminder migrations. Deploy the `mock-interview` Supabase Edge Function.

Set these Supabase Edge Function secrets:

- `TAVUS_API_KEY` — the Tavus API key. Keep it server-side; do not use a `VITE_` prefix.
- `TAVUS_FACE_ID` — the Tavus face/replica asset ID used when the function creates a new interviewer PAL for each session.
- `OPENROUTER_API_KEY` — the existing OpenRouter key used for CV summaries and feedback reports.

The function reads `TAVUS_API_KEY` and `TAVUS_FACE_ID` from Supabase Edge Function secrets, creates a Tavus PAL dynamically with the interview system prompt, then creates a conversation from that PAL. Requests authenticate using Tavus's documented `x-api-key` header. Upstream error responses are logged by the Edge Function and returned to the client as concise JSON errors. See [Tavus PAL creation](https://docs.tavus.io/api-reference/pals/create-pal), [conversation creation](https://docs.tavus.io/api-reference/conversations/create-conversation), and [conversation status/transcript](https://docs.tavus.io/api-reference/conversations/get-conversation).

The CVI room URL is embedded directly in the authenticated mock interview page. The user’s browser receives the room URL, but never receives the Tavus API key.
