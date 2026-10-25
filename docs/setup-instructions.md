# Setup

The Pages console is connected to the published Retell agents. Calls start when a public key or the proxy is configured. Sample rows in the browser are labeled `sample` or `script_preview`.

Account:

| Setting | Value |
|---|---|
| Workspace | BDHousing |
| Org | `org_b6zBp6LIqhl3aV7n` |
| Inbound agent | `agent_dc1a3df8b89476e4868363ee98` |
| Outbound agent | `agent_2603c7b2c919d2677273e30634` |
| API key name | `bdhousing-voice` (value goes in `RETELL_API_KEY` only) |

## 1. Environment

```bash
cp .env.example .env
```

Fill `RETELL_API_KEY` with the bdhousing-voice key. The agent ids are already in `.env.example`. Leave `RETELL_FROM_NUMBER` empty until a number is bound.

These names are the contract for this repo, the proxy, n8n, and any other site that reuses the account.

## 2. Web test from GitHub Pages

Retell allows a public key in the browser when its domain list includes the site.

1. Retell → Settings → API keys → create a **public** key.
2. Allowlist `https://rabinmia975.github.io`. Add `http://localhost:8000` (or whichever port you use) for local checks.
3. Edit `docs/retell-config.js`:

   ```js
   publicKey: "public_key_...",
   proxyUrl: ""
   ```

4. Open the AI Voice Agent page, enter a name, confirm consent, and choose **Start web call**.
5. Inbound Calls → **Start inbound web test** uses the inbound agent. The Retell dashboard web test on that agent is the same path.

`publicKey` must start with `public_key_`. The page refuses other values so the secret key is not pasted into the static file.

## 3. Proxy (holds the secret)

```bash
node server/retell-proxy.mjs
```

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Config flags. No secrets. |
| POST | `/v1/web-call` | `{ "agent": "inbound" \| "outbound", "retell_llm_dynamic_variables": {} }` → Retell `POST /v3/create-web-call` |
| POST | `/v1/phone-call` | `{ "to_number", "consent_granted": true, ... }` → Retell `POST /v2/create-phone-call` |
| POST | `/v1/stop-call` | `{ "call_id" }` |
| POST | `/v1/retell-webhook` | Verifies `X-Retell-Signature`, returns 204, forwards the raw body if `N8N_INBOUND_WEBHOOK_URL` is set |

Set `proxyUrl` in `retell-config.js` to the proxy origin. The static page calls `/v1/web-call` and `/v1/phone-call`.

If the proxy is on the public internet, set `PROXY_SHARED_SECRET` and send `X-Proxy-Secret`. The committed Pages config does not include that secret. Use the public key for the public web test, and keep phone calls on a proxy you control.

`ALLOWED_ORIGINS` defaults to `https://rabinmia975.github.io`. Localhost is always allowed. CORS is not authentication: a secret is what stops strangers from dialing.

## 4. n8n

Import:

- `n8n/workflow-retell-outbound.json` — outbound trigger for this site or any other caller
- `n8n/workflow-b-incoming-calls.json` — Retell webhook events
- `n8n/workflow-a-outgoing-calls.json` — optional Laravel phone-call bridge
- `n8n/workflow-c-follow-up.json` — optional follow-ups

Set the variables from `.env.example` in the n8n environment. Activate a workflow only after a web test against your own microphone or a phone number you control.

Outbound webhook body:

```json
{
  "channel": "web",
  "agent": "outbound",
  "consent_granted": true,
  "customer_name": "Rahim Ahmed",
  "preferred_language": "bn",
  "property_interest": "apartment",
  "call_purpose": "Lead follow-up"
}
```

Phone calls use `"channel": "phone"` and `"to_number": "+8801..."`. `consent_granted` must be `true`. The from-number is `RETELL_FROM_NUMBER` on the server, not a field the browser invents.

When `N8N_WEBHOOK_SECRET` is set, send `X-N8N-Secret`.

## 5. Inbound number and webhooks

No number is configured yet. Web calls work without one.

When you are ready for the PSTN:

1. Retell → Phone Numbers → buy or import.
2. Inbound agent: `agent_dc1a3df8b89476e4868363ee98`.
3. Outbound agent: `agent_2603c7b2c919d2677273e30634`.
4. Webhook URL: `https://<host>/v1/retell-webhook` (proxy) or `https://<n8n>/webhook/bdhousing/retell-webhook`.
5. Events: `call_started`, `call_ended`, `call_analyzed`.
6. Set `RETELL_FROM_NUMBER` to the E.164 value and restart the proxy or n8n.

The signature is `X-Retell-Signature` in the form `v=<timestamp>,d=<hex>`. It is HMAC-SHA256 of the raw body concatenated with the timestamp, keyed by `RETELL_API_KEY`. The proxy checks the timestamp is within five minutes. Retell’s allowlisted IP is `100.20.5.228`.

Until the number exists, test the inbound agent with **Start inbound web test** or the dashboard web call on that agent.

## 6. Another site

Copy `.env`, the proxy, and the n8n workflows. Add the new origin to the public-key allowlist and to `ALLOWED_ORIGINS`. Point that site’s config at the same agent ids. See the README section “Reuse the same account on another site”.
