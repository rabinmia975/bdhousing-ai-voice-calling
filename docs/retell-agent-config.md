# Retell AI Agent Configuration — BDHousing AI Assistant

Published agents in workspace **BDHousing** (`org_b6zBp6LIqhl3aV7n`):

| Direction | Agent ID | Used for |
|---|---|---|
| Inbound | `agent_dc1a3df8b89476e4868363ee98` | Numbers bound as inbound, and the inbound web test |
| Outbound | `agent_2603c7b2c919d2677273e30634` | `create-phone-call` (`override_agent_id`) and the outbound web test |

The API key is the one named **bdhousing-voice**. Store it as `RETELL_API_KEY`. The static site uses a separate public key (`public_key_…`) or a proxy. Listen to Bangla and English test calls on these published agents before you rely on them with customers.

## Agent basics

| Setting | Value |
|---|---|
| Agent name | BDHousing AI Assistant |
| Voice | Professional, warm, moderate pace (test both bn-BD and en voices; pick the verified one per language) |
| Languages | Bangla (primary), English |
| Response latency | Balanced — natural pacing over fast |
| Interruption | Enabled — customer can interrupt anytime; agent stops and listens |
| End-of-call | Waits for natural pause, confirms nothing else is needed, thanks caller |

## System prompt (starting point — tune on real test calls)

```
You are the BDHousing AI Assistant, calling on behalf of BDHousing, a property
listing and real estate company in Bangladesh.

ALWAYS:
- Introduce yourself transparently as an AI assistant in the first message.
- Speak the customer's language (Bangla default, switch to English on request).
- Ask exactly ONE question at a time. Adapt to the customer's answers.
- Be professional, warm, and concise.
- Answer property questions ONLY from the provided BDHousing data/FAQ context.
  If information is not in the context, say you will have a representative
  follow up. NEVER invent prices, availability, addresses, or listing details.
- Let the customer skip any question or ask for a human representative at any time.

NEVER:
- Never ask for sensitive data beyond what is needed (no NID, no financial
  account details). Financing needs are asked about only voluntarily.
- Never claim to be a human.
- Never make another call promise without recording consent.

If the customer says they do not want further calls, acknowledge politely,
confirm no future calls, and mark DO_NOT_CALL in your final extraction.
```

## Opening line (outgoing calls)

> "আসসালামু আলাইকুম। আমি BDHousing-এর AI assistant। আপনি কি বাড়ি বা ফ্ল্যাট কেনা, ভাড়া
> নেওয়া, অথবা property সম্পর্কে তথ্য পেতে আগ্রহী?"

## Conversation flow (one question at a time)

1. Greeting + intent (the opening line above)
2. Full name
3. Preferred language (if the caller's language is unclear)
4. Purpose: Buy / Rent / Sell / List Property / General Inquiry
5. Preferred location or area
6. Property type: Apartment / House / Land / Commercial
7. Budget range in BDT
8. Preferred size (sqft)
9. Bedrooms (only if property type applies)
10. Move-in / purchase timeline
11. Financing requirements — voluntary, skippable
12. Additional requirements
13. Interest level (Hot / Warm / Cold — inferred from responses)
14. Preferred callback date and time
15. Permission for future follow-up calls (explicit consent)

Escalation: if the customer requests a human, record `callback_requested`, offer a
representative callback time, and end the call politely.

## Dynamic variables sent per call (from Laravel)

`customer_name`, `phone`, `preferred_language`, `property_interest`, `call_purpose`

## Extraction fields (Retell post-call analysis)

`full_name`, `phone_number`, `preferred_language`, `interest_type`,
`preferred_area`, `property_type`, `budget_min_bdt`, `budget_max_bdt`,
`size_sqft`, `bedrooms`, `timeline`, `financing_required`,
`additional_requirements`, `interest_level`, `callback_datetime`,
`followup_consent`, `outcome`

`outcome` classification set: `interested` / `callback_requested` /
`do_not_call` / `not_interested` / `no_answer` / `failed`

## Webhook events to configure

Retell posts `call_started`, `call_ended`, and `call_analyzed`.

| Destination | When to use it |
|---|---|
| `https://<proxy>/v1/retell-webhook` | Preferred. Verifies the raw body with `RETELL_API_KEY`, then forwards to n8n. |
| `https://<n8n>/webhook/bdhousing/retell-webhook` | Workflow B. Use the proxy in front when n8n parses the body before your code runs. |

The signature header is `X-Retell-Signature` (`v=<unix-ms>,d=<hmac-sha256>`). The HMAC key is the bdhousing-voice API key, not a separate webhook secret. The signed bytes are the raw JSON body concatenated with the timestamp.

No phone number is bound in this repo. After you buy or import one, set its inbound agent and outbound agent to the ids above and copy the E.164 value into `RETELL_FROM_NUMBER`. Until then, web calls (this console or the Retell dashboard) are the test path.

## Pre-production checklist

- [ ] Bangla voice test calls reviewed and approved on the published agents
- [ ] English voice test calls reviewed and approved
- [ ] Phone number purchased or imported, inbound and outbound agents bound
- [ ] `RETELL_FROM_NUMBER` set only on the proxy or n8n
- [ ] Webhook signature verified end-to-end (`call_started`, `call_ended`, `call_analyzed`)
- [ ] Opt-out path tested (DNC suppresses the next outbound)
- [ ] Human escalation path tested
