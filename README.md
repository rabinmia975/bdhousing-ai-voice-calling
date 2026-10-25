# BDHousing AI Voice Calling

Voice calls for **BDHousing** run on **Retell AI**. The GitHub Pages console talks to the published agents. The secret API key stays in an environment variable on a small proxy or in n8n, so the same credentials can be reused by any other site.

| | |
|---|---|
| Workspace | BDHousing |
| Org | `org_b6zBp6LIqhl3aV7n` |
| Inbound agent (published) | `agent_dc1a3df8b89476e4868363ee98` |
| Outbound agent (published) | `agent_2603c7b2c919d2677273e30634` |
| API key name in Retell | `bdhousing-voice` |

The key value is not in this repo. Copy `.env.example` to `.env` and paste it there, or set the same variables in n8n.

## How a call is placed

```
GitHub Pages (docs/)
  ├─ publicKey (public_key_…)  → Retell web call from the browser
  └─ proxyUrl                  → Node proxy or n8n webhook
                                    └─ RETELL_API_KEY
                                         ├─ POST /v3/create-web-call
                                         └─ POST /v2/create-phone-call
Inbound phone number (when you bind one)
  └─ Retell inbound agent → webhook → proxy verifies signature → n8n
```

Web calls need either a domain-allowlisted Retell **public** key or the proxy. Phone calls always go through the proxy or n8n, because Retell requires the secret key for `create-phone-call`. There is no from-number in the repo yet. Until you buy or import one, use a web call (this site or the Retell dashboard test button).

## Put the live credentials in

1. In Retell, open the key named **bdhousing-voice**. It needs the webhook badge, because signature checks use that key.
2. Create `.env` from the example and fill the secret there:

   ```bash
   cp .env.example .env
   # RETELL_API_KEY=        the bdhousing-voice value
   # agent ids are already filled
   # RETELL_FROM_NUMBER=    E.164, only after a number is bound
   ```

3. Web test on GitHub Pages, without exposing the secret:
   - Retell dashboard → Public keys → create a key.
   - Allowlist `https://rabinmia975.github.io` (add any other site origin too).
   - Put that `public_key_…` value in `docs/retell-config.js` as `publicKey`.
   - Leave `RETELL_API_KEY` out of that file.
4. Phone calls, and web calls if you skip the public key:

   ```bash
   node server/retell-proxy.mjs
   ```

   Set `proxyUrl` in `docs/retell-config.js` to the proxy origin, for example `http://localhost:8787`. The Pages site at `https://rabinmia975.github.io` can call it only if the proxy is on a public HTTPS host and `ALLOWED_ORIGINS` includes that origin.
5. Or import the n8n workflows (below) and set `proxyUrl` to `https://<n8n>/webhook/bdhousing/retell-outbound`.

`docs/retell-config.js` already contains the org and both agent ids. Those are identifiers, not secrets.

## n8n

Import these files with **Workflows → Import from File**. They are saved inactive.

| File | Role |
|---|---|
| `n8n/workflow-retell-outbound.json` | Webhook `bdhousing/retell-outbound`. Body `{ "channel": "web" \| "phone", "agent": "inbound" \| "outbound", ... }` calls Retell and returns `call_id` / `access_token`. |
| `n8n/workflow-a-outgoing-calls.json` | Laravel-style outbound phone call (`bdhousing/outgoing-call`). |
| `n8n/workflow-b-incoming-calls.json` | Retell events `call_started`, `call_ended`, `call_analyzed` (`bdhousing/retell-webhook`). |
| `n8n/workflow-c-follow-up.json` | Follow-up scheduler. It calls your API, not Retell directly. |

In the n8n environment (not inside the JSON) set:

```
RETELL_API_KEY
RETELL_INBOUND_AGENT_ID=agent_dc1a3df8b89476e4868363ee98
RETELL_OUTBOUND_AGENT_ID=agent_2603c7b2c919d2677273e30634
RETELL_FROM_NUMBER=
N8N_WEBHOOK_SECRET=
```

The workflows read `$env`. If n8n blocks env access, allow it for these variables. Do not paste the API key into the workflow file.

Set `N8N_WEBHOOK_SECRET` before the outbound webhook is reachable from the internet, and send it as `X-N8N-Secret`. An open webhook can place paid calls.

Point the Retell agent webhook at either:

- `https://<proxy>/v1/retell-webhook` (checks the raw-body HMAC, then forwards to `N8N_INBOUND_WEBHOOK_URL` with `X-Proxy-Secret`), or
- `https://<n8n>/webhook/bdhousing/retell-webhook`

The proxy path is the one that verifies Retell's exact bytes. n8n often parses JSON before a Code node can see those bytes.

## Reuse the same account on another site

1. Copy `.env.example`, `server/retell-proxy.mjs`, and the `n8n/` workflows into the other project.
2. Use the same `RETELL_API_KEY`, agent ids, and `RETELL_FROM_NUMBER`. One Retell workspace serves every site.
3. Add the other site's origin to `ALLOWED_ORIGINS` and, if that site starts web calls itself, add the origin to the Retell public key allowlist.
4. Give the other site its own `retell-config.js` with the same agent ids, its own `publicKey` (or the same key once the domain is allowlisted), and its own `proxyUrl`.
5. Keep `RETELL_API_KEY` on the server. The browser only receives a per-call `access_token` or uses `public_key_…`.

## Test

**Web (no phone number required)**

1. Set `publicKey` or run the proxy and set `proxyUrl`.
2. Open the site over HTTPS or `http://localhost` (a `file://` page cannot use the microphone).
3. AI Voice Agent → customer name → consent → **Start web call**. Allow the microphone.
4. You are talking to outbound agent `agent_2603c7b2c919d2677273e30634`. The activity panel shows the Retell `call_id`.
5. Inbound Calls → **Start inbound web test** talks to `agent_dc1a3df8b89476e4868363ee98`. The same test exists in the Retell dashboard on that agent.

**Phone (after a number is bound)**

1. Buy or import a number in Retell. Bind the inbound and outbound agents. Set `RETELL_FROM_NUMBER`.
2. **Place phone call** with an E.164 number you are allowed to dial. Confirm the prompt. Retell returns a `call_id`.
3. Place a call to the bound number from a handset. The inbound agent answers, and the webhook receives `call_started`, then `call_ended`, then `call_analyzed`.

**Script preview** is a separate text button. It does not contact Retell and it labels the row `script_preview`.

Check the proxy without a key:

```bash
node server/retell-proxy.mjs --self-test
node server/retell-proxy.mjs
curl -s localhost:8787/health
```

`/health` reports `provider: "retell"` and whether the key and from-number are set. It does not print the key.

## Pages

GitHub Pages serves the `docs/` folder. `docs/index.html` and `docs/retell-config.js` are the console. `demo/` is the same console for local use. No build step is required.

## More detail

| Path | Contents |
|---|---|
| `docs/setup-instructions.md` | Step-by-step for the proxy, n8n, and number binding |
| `docs/retell-agent-config.md` | Agent ids, prompt, extraction, webhook events |
| `docs/laravel-backend-plan.md` | Optional Laravel persistence |
| `server/retell-proxy.mjs` | Secret-holding HTTP proxy |
| `.env.example` | Variable names shared across sites |
