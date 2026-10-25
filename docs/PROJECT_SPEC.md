# Project Spec: BDHousing AI Voice Calling Demo

> This is the verbatim source specification. Every implementation decision must satisfy it.

## Project Goal
Create a functional demo of an AI Voice Calling Agent for BDHousing, a Bangladesh-based property listing and real estate business.

The demo must connect:
- Retell AI for voice conversations and phone calls.
- n8n for workflow automation.
- Laravel REST API and MySQL for customer and property lead management.
- A modern admin dashboard for managing AI calls and customer information.

Do not build only a static UI. Create a working demo with clear integration points and a simulated calling mode if real telephony credentials are not configured.

## 1. AI Voice Agent Dashboard

Create an admin page named **AI Voice Agent** with:

- Agent name: BDHousing AI Assistant
- Agent status: Active / Inactive
- Provider: Retell AI
- Supported languages: Bangla and English, subject to verified voice support
- Incoming calls enabled/disabled
- Outgoing calls enabled/disabled
- Phone number and SIP configuration status
- n8n connection status
- Laravel API connection status

Add a professional interface with a dark navy sidebar, white content area, green status indicators, orange action buttons, call statistics, and responsive layouts.

## 2. Outgoing Call Demo

Add a button labeled "Test AI Call".

Allow an admin to enter:
- Customer name
- Customer phone number with country code
- Preferred language
- Property interest
- Call purpose

When the admin clicks the button:
1. Validate the phone number and customer consent.
2. Check whether live telephony is configured.
3. If configured, send a call request to the Laravel backend, then trigger n8n and Retell AI.
4. If not configured, start a simulated call demo and clearly label it "Simulation — No real phone call".
5. Show the call status: Queued, Initiated, Ringing, In Progress, Completed, Failed, or Cancelled.
6. Display a live call activity panel when supported by the provider, or a simulated conversation panel in demo mode.

Never claim a real call was placed when using simulation mode.

## 3. AI Conversation Script

The AI assistant should introduce itself transparently:

"আসসালামু আলাইকুম। আমি BDHousing-এর AI assistant। আপনি কি বাড়ি বা ফ্ল্যাট কেনা, ভাড়া নেওয়া, অথবা property সম্পর্কে তথ্য পেতে আগ্রহী?"

The AI should ask one question at a time and adapt to the customer's responses.

Collect these details:
- Customer's full name
- Phone number
- Preferred language
- Purpose: Buy / Rent / Sell / List Property / General Inquiry
- Preferred location or area in Bangladesh
- Property type: Apartment / House / Land / Commercial
- Budget range in BDT
- Preferred property size in square feet
- Number of bedrooms, if applicable
- Preferred move-in or purchase timeline
- Financing requirements, if voluntarily shared
- Additional requirements
- Interest level: Hot / Warm / Cold
- Preferred callback date and time
- Permission for future follow-up calls

Do not ask unnecessary sensitive questions. Allow customers to skip any question and request a human representative.

The AI must answer questions only from verified BDHousing property data or approved FAQs. Never invent property prices, availability, addresses, or listing details.

If the customer requests no further calls, immediately record the opt-out and suppress future outbound calls.

## 4. Customer Lead Management

Create a Customer Leads page with:
- Search by customer name or phone number
- Filter by location, budget, property type, lead status, and call date
- Customer profile and complete call history
- Collected property preferences
- AI-generated call summary
- Follow-up reminders
- Assigned sales representative
- Export to CSV

Use a lead table with these columns:

Customer, Phone, Interest Type, Preferred Area, Budget, Property Type, Lead Score, Last Call, Follow-up Date, Status, Actions.

Lead statuses:
New, Contacted, Interested, Qualified, Follow-up Required, Converted, Not Interested, Do Not Call.

## 5. Call History and Analytics

Create a Call History page displaying:
- Call ID
- Customer
- Direction: Incoming / Outgoing
- Start time and duration
- Call status
- AI agent
- Call outcome
- Summary
- Transcript, when available
- Recording link, when available and legally permitted

Add analytics for total calls, answered calls, completed calls, interested leads, qualified leads, failed calls, and follow-up tasks.

Use real database data when connected. Use clearly labeled mock data only in demo mode.

## 6. Incoming Call Demo

Create a configurable incoming-call workflow.

When the phone provider routes an incoming call to Retell AI:
1. Greet the caller.
2. Identify the customer's intent.
3. Answer verified property questions.
4. Collect relevant lead information.
5. Offer a human callback if necessary.
6. Save the call result and lead information through the Laravel API.

If live incoming calling is not configured, provide an interactive simulated conversation to demonstrate the workflow.

## 7. Laravel Backend

Use the existing Laravel application if available. Inspect the existing authentication, routes, database schema, and admin layout before changing files.

Create migrations and models for:
- Property leads
- AI calls
- AI call summaries
- Call consent and opt-out records
- Follow-up tasks

Recommended tables:
- property_leads
- ai_calls
- ai_call_summaries
- call_consents
- follow_up_tasks

Create secure REST endpoints for:
- Listing eligible leads
- Creating outbound call jobs
- Receiving Retell webhooks
- Updating call status
- Saving extracted customer information
- Creating follow-up tasks
- Managing customer opt-outs
- Reading call history and analytics

Use Laravel validation, authentication, authorization, database transactions where appropriate, queue jobs, logging, rate limiting, and idempotent webhook processing.

Store provider credentials in environment variables. Never expose API keys in frontend JavaScript.

## 8. n8n Integration

Design workflows for:

Workflow A — Outgoing Calls:
Laravel lead selection → consent and duplicate checks → n8n → Retell call API → webhook → Laravel database update.

Workflow B — Incoming Calls:
Telephony provider → Retell AI → call-ended webhook → n8n → customer lookup or creation → Laravel database update.

Workflow C — Follow-up:
Eligible leads → schedule and consent checks → call queue → call outcome → follow-up task.

Include retry limits, failure logging, webhook authentication, duplicate prevention, rate limits, and a manual pause control.

Provide importable n8n workflow JSON if the environment allows it. Use placeholder credentials and document every required configuration.

## 9. Retell AI Configuration

Create a documented Retell agent setup with:
- Agent name: BDHousing AI Assistant
- Professional, friendly real-estate customer service personality
- Natural Bangla and English conversation, only after language support is verified
- One question at a time
- Customer interruption handling
- Appropriate call-ending behavior
- Lead information extraction
- Call outcome classification
- Human callback escalation
- Webhook integration for call events

Verify language, voice, SIP, and phone-number compatibility before enabling production calls.

## 10. Demo Mode and Safety

The app must work without live phone credentials.

In demo mode:
- Simulate call initiation and status changes.
- Show a sample AI conversation.
- Extract sample customer preferences.
- Save the demo lead to the development database.
- Display a clear "Demo Mode — No real call is being placed" notice.
- Never send a real phone call unless an authorized admin explicitly enables live mode and confirms the action.

Do not simulate real customer consent or falsely mark a real call as completed.

Require customer consent where applicable, disclose AI identity, provide an opt-out mechanism, respect applicable Bangladesh telecom rules, and restrict access to call recordings and transcripts.

## 11. Deliverables

Deliver:
1. Working responsive AI Voice Agent admin page.
2. Interactive simulated outgoing and incoming call demos.
3. Customer lead management and call history pages.
4. Laravel migrations, models, controllers, routes, and validation.
5. n8n workflow definitions.
6. Retell AI integration service and webhook handler.
7. Environment variable template.
8. Setup instructions and test cases.
9. Clear separation between demo and live modes.

First inspect the existing project and preserve its architecture and design system. Implement the smallest working end-to-end demo first. Do not overwrite unrelated files or claim external integrations are live unless they have been tested successfully.
