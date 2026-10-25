# Test Cases

## Demo mode

| # | Test | Expected |
|---|---|---|
| D1 | Dashboard loads | Agent card shows statuses; banner: "Demo Mode — No real call is being placed" |
| D2 | Test AI Call with valid +880 number | Statuses progress Queued → Initiated → Ringing → In Progress → Completed; conversation panel shows sample dialog |
| D3 | Call detail | Saved with mode=demo, lead created with is_demo=true, sample extracted preferences |
| D4 | Invalid phone (missing country code) | Validation error, no call created |
| D5 | Simulated incoming call | Interactive conversation plays; lead + call saved on completion |
| D6 | Leads page | New demo lead visible, searchable by name/phone, CSV export works |
| D7 | Analytics | Call counts include the demo call; mock data is labeled |

## Live mode (only with verified credentials)

| # | Test | Expected |
|---|---|---|
| L1 | Enable live mode | Requires authorized admin toggle + explicit confirmation |
| L2 | Test AI Call (consent given) | Laravel job → n8n Workflow A → Retell creates the call; statuses from webhooks |
| L3 | Retell `call.analyzed` webhook | Extraction saved to ai_call_summaries; idempotent when resent |
| L4 | Webhook without valid signature | Rejected 401, nothing processed |
| L5 | Incoming call to Retell number | Retell answers, Workflow B updates Laravel, lead matched or created |
| L6 | Customer says "no more calls" | outcome=do_not_call; lead status=Do Not Call; next outbound suppressed |

## Safety / compliance

| # | Test | Expected |
|---|---|---|
| S1 | Duplicate call prevention | Outbound job refuses a second active call for the same lead |
| S2 | Demo label honesty | Demo call records can never be shown as live/completed real calls |
| S3 | Skippable questions | "Skip" in simulated conversation moves on without data |
| S4 | Human escalation | Requesting a human creates a follow-up task with callback time |
| S5 | Opt-out suppression | After opt-out, the leads API excludes the phone from outbound eligibility |
| S6 | Credentials | No API keys present in frontend JS or committed files |
| S7 | Rate limits | Repeated webhook/endpoint calls throttled per Laravel config |
