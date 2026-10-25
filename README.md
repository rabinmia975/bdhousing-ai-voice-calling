# BDHousing AI Voice Calling Demo

An AI Voice Calling Agent for **BDHousing** (Bangladesh property listing & real estate), connecting:

- **Retell AI** — voice conversations and telephony
- **n8n** — workflow automation (outgoing calls, incoming calls, follow-ups)
- **Laravel REST API + MySQL** — lead, call, consent, and follow-up management
- **Admin dashboard** — AI Voice Agent, Customer Leads, Call History & Analytics pages

> **Demo Mode notice:** The app works fully without live phone credentials. In demo mode no real
> phone call is ever placed, and the UI always shows "Demo Mode — No real call is being placed".
> Live mode requires an authorized admin to explicitly enable it and confirm each action.

## Architecture

```
                    ┌────────────────────┐
   Admin Dashboard ─│  Laravel App       │── MySQL (leads, calls, consents, tasks)
   (AI Voice Agent, │  REST API + Webhook│
   Leads, History)  └─────────┬──────────┘
                              │ REST + webhooks
                    ┌─────────▼──────────┐
                    │  n8n Workflows     │
                    │  A: Outgoing calls │
                    │  B: Incoming calls │
                    │  C: Follow-ups     │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Retell AI Agent    │── SIP / phone number
                    │  (Bangla/English)  │
                    └────────────────────┘
```

## What's in this repo

| Path | Contents |
|---|---|
| `docs/PROJECT_SPEC.md` | Full project specification (source of truth) |
| `docs/laravel-backend-plan.md` | Migrations, models, REST endpoints, webhook handling |
| `docs/retell-agent-config.md` | Retell AI agent personality, prompts, extraction fields |
| `docs/setup-instructions.md` | End-to-end setup for demo mode and live mode |
| `docs/test-cases.md` | Manual test cases for acceptance |
| `n8n/` | Importable n8n workflow JSONs (A, B, C) with placeholder credentials |
| `.env.example` | Environment variable template — never commit real keys |

## Mode separation

| | Demo Mode (default) | Live Mode |
|---|---|---|
| Call initiation | Simulated status progression | Laravel → n8n → Retell call API |
| Conversation | Simulated conversation panel | Real Retell AI conversation |
| Lead data | Saved to dev database, clearly labeled | Saved to production database |
| UI badge | "Demo Mode — No real call is being placed" | Explicit live confirmation per call |

Switching to live mode: see `docs/setup-instructions.md` — requires Retell API key, phone number /
SIP trunk, n8n reachable by webhook, and an explicit admin toggle + confirmation.

## Safety & compliance

- AI discloses its identity in the greeting.
- Customer consent recorded per call; "Do Not Call" opt-out suppresses all future outbound calls immediately.
- Customers can skip any question or ask for a human representative.
- The AI answers only from verified BDHousing property data or approved FAQs — it never invents
  prices, availability, addresses, or listing details.
- Bangladesh telecom rules respected; recordings/transcripts access-restricted.
