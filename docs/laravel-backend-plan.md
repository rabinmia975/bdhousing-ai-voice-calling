# Laravel Backend Plan

> Apply inside the existing BDHousing Laravel app. Before touching anything: inspect the auth
> setup, `routes/`, existing migrations, and the admin layout. Preserve the architecture and
> design system. Implement the smallest end-to-end slice first (demo mode), then extend.

## Database schema (migrations)

### `property_leads`
| Column | Type | Notes |
|---|---|---|
| id | bigIncrements | |
| full_name | string | |
| phone | string, indexed | E.164, unique per source |
| preferred_language | enum(bn,en) | default: bn |
| interest_type | enum(buy,rent,sell,list_property,general_inquiry) | |
| preferred_area | string nullable | |
| property_type | enum(apartment,house,land,commercial) nullable | |
| budget_min_bdt / budget_max_bdt | decimal nullable | |
| size_sqft | unsignedInteger nullable | |
| bedrooms | tinyInteger nullable | |
| timeline | string nullable | move-in / purchase |
| financing_required | boolean nullable | voluntarily shared only |
| additional_requirements | text nullable | |
| interest_level | enum(hot,warm,cold) nullable | |
| preferred_callback_at | datetime nullable | |
| follow_up_consent | boolean default false | |
| lead_score | tinyInteger default 0 | |
| status | enum(new,contacted,interested,qualified,follow_up_required,converted,not_interested,do_not_call) | default: new |
| assigned_sales_rep_id | unsignedBigInteger nullable FK | |
| is_demo | boolean default false | demo-mode records clearly labeled |
| created_date / updated | timestamps | |

### `ai_calls`
| Column | Type | Notes |
|---|---|---|
| id | bigIncrements | Call ID shown in history |
| property_lead_id | FK nullable | nullable for unmatched incoming callers |
| direction | enum(incoming,outgoing) | |
| provider_call_id | string nullable indexed | Retell call_id (idempotency key for webhooks) |
| agent_name | string default 'BDHousing AI Assistant' | |
| phone_number | string | |
| status | enum(queued,initiated,ringing,in_progress,completed,failed,cancelled) | |
| outcome | string nullable | e.g. interested, callback_requested, do_not_call |
| started_at / ended_at / duration_seconds | datetime/int nullable | |
| mode | enum(demo,live) | **never mark a simulated call 'live'** |
| is_demo | boolean | derived from mode, kept for filtering |
| error_message | text nullable | |

### `ai_call_summaries`
- ai_call_id FK, ai_summary text, extracted_data json (the collected lead fields),
  transcript_url nullable, recording_url nullable (access-restricted)

### `call_consents`
- property_lead_id FK, phone string, consent_granted boolean, source enum(call,web,manual),
  captured_at, expires_at nullable

### `follow_up_tasks`
- property_lead_id FK, ai_call_id FK nullable, due_at datetime, assigned_sales_rep_id nullable,
  status enum(pending,done,cancelled), notes text

## REST endpoints (all under auth + role middleware; admin-only)

- `GET  /api/ai-calls/agent-status` — agent config + provider/n8n/api connection statuses
- `GET  /api/ai-calls/analytics` — totals: calls, answered, completed, interested, qualified, failed, follow-ups
- `GET  /api/leads` — search (name/phone) + filters (area, budget, property type, status, call date)
- `GET  /api/leads/{id}` — profile, preferences, call history, summaries, tasks
- `GET  /api/leads/export` — CSV download
- `POST /api/ai-calls/outbound` — validate phone + consent → create `ai_calls` row (queued) → dispatch job
- `POST /api/ai-calls/{id}/cancel` — admin cancel
- `POST /api/retell/webhook` — **public but signed** (Retell webhook signature), idempotent by `provider_call_id` + event
- `PATCH /api/ai-calls/{id}/status` — internal status updates from jobs/webhooks
- `POST /api/leads/{id}/consent` / `POST /api/leads/{id}/opt-out` — consent grant / DNC, opt-out suppresses outbound immediately
- `POST /api/follow-up-tasks` / `GET /api/follow-up-tasks` — reminders list & create
- `GET  /api/ai-calls` — call history with filters (direction, status, date range)

## Webhook handling rules

1. Verify Retell webhook signature header (`X-Retell-Signature`) against `RETELL_WEBHOOK_SECRET` before any processing.
2. Idempotency: unique index on `(provider_call_id, event_type)` — replayed events are skipped.
3. Wrap lead + call updates in `DB::transaction()`.
4. Queue heavy processing (`ShouldQueue` listeners); webhooks return 200 fast.
5. Rate limiting on all public endpoints (`throttle:` middleware).
6. Log every webhook event (structured logging channel `ai-calls`).

## Outbound call job (queued)

`InitiateAiCallJob(callId)`:
1. Reload call + lead. Abort if lead has DNC/opt-out, or an active call already exists (duplicate prevention).
2. If `AI_CALL_MODE=demo` → run `SimulateAiCall` (progress statuses with delays, sample conversation, save extracted sample data, mark `mode=demo`). **No HTTP to telephony.**
3. If live: `RetellService::createPhoneCall()` using `RETELL_API_KEY` and the agent's `RETELL_AGENT_ID` from env only.
4. Update status from Retell responses / webhooks.

## Validation highlights

- Phone: `regex:/^\+?[1-9]\d{7,14}$/` (E.164) + normalize BD numbers (+880...).
- Consent checkbox required for outbound initiation in live mode.
- Enum fields validated against the exact enums above.
- `language` restricted to enabled languages from agent config.

## Credentials

All provider credentials live in `.env` (see `.env.example`). Never in frontend JS, never committed.
