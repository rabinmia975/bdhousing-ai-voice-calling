# Test Cases

## Pages console (no secret in the browser)

| # | Test | Expected |
|---|---|---|
| P1 | Dashboard loads | Provider badge says Retell AI. Outbound agent `agent_2603c7b2c919d2677273e30634` and inbound agent `agent_dc1a3df8b89476e4868363ee98` are visible. Org `org_b6zBp6LIqhl3aV7n`. |
| P2 | No public key and no proxyUrl | Web and phone buttons are disabled. Setup text names `publicKey` and `RETELL_API_KEY`. The old "Demo Mode — No real call is being placed" banner is absent. |
| P3 | `publicKey` set to a non-public value | The page warns that the secret key does not belong in `retell-config.js`. |
| P4 | Valid `public_key_…` or a running proxy | **Start web call** reaches Retell. The activity panel shows a `call_id`. History mode is `live` and provider is `retell`. |
| P5 | Inbound web test | Uses inbound agent `agent_dc1a3df8b89476e4868363ee98`. Copy on the page explains number binding and the dashboard web test. |
| P6 | Place phone call with no `RETELL_FROM_NUMBER` | Proxy returns 409 and tells you to bind a number. No call id is stored as completed. |
| P7 | Place phone call with consent and a from-number | Browser asks you to confirm. Proxy calls `POST /v2/create-phone-call` with the outbound agent. |
| P8 | Preview the script button | Panel says Retell is not contacted. Saved row mode is `script_preview`. |
| P9 | Invalid phone | Validation error. No request is sent. |
| P10 | Leads and CSV | Sample leads search and export. |
| P11 | Secrets | `RETELL_API_KEY` is absent from `docs/`, `demo/`, and `n8n/`. `.env` is gitignored. |

## Proxy

| # | Test | Expected |
|---|---|---|
| X1 | `node server/retell-proxy.mjs --self-test` | Passes. |
| X2 | `GET /health` | `provider` is `retell`. `api_key_configured` is a boolean. The key is not in the body. |
| X3 | Phone call without `consent_granted: true` | 400. |
| X4 | Webhook with a bad signature | 401. |
| X5 | Webhook with a valid HMAC | 204. |

## n8n and Laravel

| # | Test | Expected |
|---|---|---|
| L1 | Import outbound and inbound workflows | Import succeeds. Workflows are inactive until you activate them. |
| L2 | Outbound webhook, web channel | n8n calls `POST /v3/create-web-call` with the outbound or inbound agent id from the environment. |
| L3 | Outbound webhook, phone channel | Requires consent, E.164 `to_number`, and `RETELL_FROM_NUMBER`. Uses `override_agent_id` of the outbound agent. |
| L4 | `call_started` / `call_ended` / `call_analyzed` | Workflow B normalizes the event. A bad signature is rejected when the raw body is available. The proxy is the raw-body verifier. |
| L5 | Customer says "no more calls" | outcome `do_not_call`; next outbound is suppressed by the API that owns the lead. |

## Safety

| # | Test | Expected |
|---|---|---|
| S1 | Duplicate active call | Workflow A refuses when `active_call_exists` is true. |
| S2 | Script preview honesty | Preview rows are `script_preview`, never `live`. |
| S3 | Opt-out | After opt-out, outbound eligibility excludes the phone. |
| S4 | Credentials | No API key value is committed. The key name `bdhousing-voice` is documentation only. |
