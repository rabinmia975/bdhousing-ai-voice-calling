# Setup Instructions

## A. Demo mode (no telephony credentials needed)

1. **Laravel app** (existing BDHousing project):
   ```bash
   cp .env.example .env
   # keep AI_CALL_MODE=demo
   php artisan migrate            # adds the 5 tables from docs/laravel-backend-plan.md
   php artisan queue:table && php artisan migrate  # if queues not yet set up
   php artisan queue:work
   ```
2. Open the admin dashboard → **AI Voice Agent** page. Banner shows
   *Demo Mode — No real call is being placed*.
3. Click **Test AI Call**, fill customer name, phone, language, property interest, purpose.
   The call progresses Queued → Initiated → Ringing → In Progress → Completed with a simulated
   conversation panel, and a demo lead is saved to the dev database (`is_demo = true`).
4. Leads page, call history, and analytics read the real (dev) database.

## B. n8n workflows

1. Import `n8n/workflow-a-outgoing-calls.json`, `workflow-b-incoming-calls.json`,
   `workflow-c-follow-up.json` into n8n (Import from File).
2. Replace the placeholder credentials (marked `PLACEHOLDER`) in each HTTP Request node:
   - `LARAVEL_API_URL` and `LARAVEL_WEBHOOK_SECRET` — for calls into Laravel
   - `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_PHONE_NUMBER_ID` — for Retell
   - `N8N_WEBHOOK_SECRET` — the shared secret Laravel uses when calling n8n
3. Every Laravel → n8n call sends `X-N8N-Secret` header; each workflow's first node verifies it.
4. Keep the **pause control**: the `Enable/Disable` switch node at the top of each workflow is
   the manual pause. All three workflows must stay **Disabled** until live mode is verified.

## C. Retell AI

1. Create the agent per `docs/retell-agent-config.md` (prompt, extraction, languages).
2. Buy/import a phone number or connect the SIP trunk.
3. Set webhooks: `call.started`, `call.analyzed`, `call.ended` → the n8n Workflow B webhook
   URL (or directly to Laravel `/api/retell/webhook`).
4. Copy the API key and webhook secret into `.env` (Laravel) and n8n credentials.

## D. Switching to live mode

1. In `.env`: `AI_CALL_MODE=live`, real `RETELL_*` values, `N8N_*` values.
2. In the AI Voice Agent admin page, an **authorized admin** flips the Live Mode toggle and
   confirms the explicit warning dialog.
3. Every "Test AI Call" still shows a confirmation before dialing a real number.
4. Enable the n8n workflows one by one, testing with a safe internal phone number first.

## E. Verification before production

- Run through `docs/test-cases.md`.
- Never report an integration as live until it has been tested successfully end-to-end.
