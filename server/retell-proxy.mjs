#!/usr/bin/env node
/**
 * BDHousing Retell proxy.
 *
 * Holds RETELL_API_KEY and calls Retell on behalf of the static GitHub Pages site
 * or any other origin you list in ALLOWED_ORIGINS. The browser receives a
 * short-lived web-call access token, never the API key.
 *
 *   node server/retell-proxy.mjs
 *   node server/retell-proxy.mjs --self-test
 *
 * Routes:
 *   GET  /health
 *   POST /v1/web-call      { agent: "inbound"|"outbound", retell_llm_dynamic_variables, metadata }
 *   POST /v1/phone-call    { to_number, consent_granted: true, retell_llm_dynamic_variables, metadata }
 *   POST /v1/stop-call     { call_id }
 *   POST /v1/retell-webhook   Retell call_started / call_ended / call_analyzed (raw body)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { pathToFileURL } from "node:url";

const RETELL_ORIGIN = "https://api.retellai.com";
const INBOUND_AGENT_DEFAULT = "agent_dc1a3df8b89476e4868363ee98";
const OUTBOUND_AGENT_DEFAULT = "agent_2603c7b2c919d2677273e30634";
const ORG_ID = "org_b6zBp6LIqhl3aV7n";
const MAX_BODY = 1_000_000;

loadDotEnv();

const config = {
  apiKey: process.env.RETELL_API_KEY || "",
  inboundAgentId: process.env.RETELL_INBOUND_AGENT_ID || INBOUND_AGENT_DEFAULT,
  outboundAgentId: process.env.RETELL_OUTBOUND_AGENT_ID || OUTBOUND_AGENT_DEFAULT,
  fromNumber: (process.env.RETELL_FROM_NUMBER || "").trim(),
  port: Number(process.env.PORT || 8787),
  sharedSecret: process.env.PROXY_SHARED_SECRET || "",
  inboundForwardUrl: (process.env.N8N_INBOUND_WEBHOOK_URL || "").trim(),
  forwardSecret: process.env.PROXY_SHARED_SECRET || process.env.N8N_WEBHOOK_SECRET || "",
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS)
};

export function verifyRetellSignature(rawBody, apiKey, signature) {
  if (!rawBody || !apiKey || !signature) return false;
  const match = /^v=(\d+),d=(.*)$/.exec(String(signature).trim());
  if (!match) return false;
  const timestamp = match[1];
  const digest = match[2];
  const skew = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(skew) || skew > 5 * 60 * 1000) return false;
  const expected = crypto.createHmac("sha256", apiKey).update(rawBody + timestamp).digest("hex");
  const actualBuf = Buffer.from(digest);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function createHandler(runtime = config) {
  return async function handle(req, res) {
    const origin = req.headers.origin || "";
    const allowOrigin = originAllowed(origin, runtime.allowedOrigins);
    if (req.method === "OPTIONS") {
      if (allowOrigin && origin) writeCors(res, origin);
      res.writeHead(204);
      res.end();
      return;
    }
    if (origin && !allowOrigin) {
      sendJson(res, 403, { error: "Origin is not in ALLOWED_ORIGINS." });
      return;
    }
    if (origin) writeCors(res, origin);

    const url = new URL(req.url || "/", "http://127.0.0.1");
    try {
      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, healthBody(runtime));
        return;
      }
      if (req.method !== "POST") {
        sendJson(res, 404, { error: "Not found." });
        return;
      }

      if (url.pathname === "/v1/retell-webhook") {
        await handleWebhook(req, res, runtime);
        return;
      }
      if (!authorized(req, runtime)) {
        sendJson(res, 401, { error: "X-Proxy-Secret does not match PROXY_SHARED_SECRET." });
        return;
      }

      const body = await readJson(req);
      if (url.pathname === "/v1/web-call") {
        await handleWebCall(body, res, runtime);
        return;
      }
      if (url.pathname === "/v1/phone-call") {
        await handlePhoneCall(body, res, runtime);
        return;
      }
      if (url.pathname === "/v1/stop-call") {
        await handleStop(body, res, runtime);
        return;
      }
      sendJson(res, 404, { error: "Not found." });
    } catch (err) {
      const status = err.statusCode || 500;
      sendJson(res, status, { error: err.message || "Proxy error.", provider: "retell" });
    }
  };
}

function healthBody(runtime) {
  return {
    ok: true,
    provider: "retell",
    workspace: "BDHousing",
    org_id: ORG_ID,
    api_key_configured: Boolean(runtime.apiKey),
    inbound_agent_id: runtime.inboundAgentId,
    outbound_agent_id: runtime.outboundAgentId,
    from_number_configured: Boolean(runtime.fromNumber),
    webhook_forward_configured: Boolean(runtime.inboundForwardUrl)
  };
}

async function handleWebCall(body, res, runtime) {
  requireApiKey(runtime);
  const which = body.agent === "inbound" ? "inbound" : "outbound";
  const agentId = which === "inbound" ? runtime.inboundAgentId : runtime.outboundAgentId;
  const payload = {
    agent_id: agentId,
    agent_version: "latest_published",
    retell_llm_dynamic_variables: stringMap(body.retell_llm_dynamic_variables),
    metadata: metadataOf(body, which)
  };
  const created = await retell("POST", "/v3/create-web-call", payload, runtime);
  sendJson(res, 201, {
    provider: "retell",
    channel: "web",
    agent: which,
    agent_id: created.agent_id || agentId,
    call_id: created.call_id,
    access_token: created.access_token,
    transport: created.transport || "gateway",
    ice_servers: created.ice_servers || [],
    expires_at: created.expires_at || null,
    call_status: created.call_status || "registered"
  });
}

async function handlePhoneCall(body, res, runtime) {
  requireApiKey(runtime);
  if (body.consent_granted !== true) {
    fail(400, "consent_granted: true is required before a phone call.");
  }
  const to = normalizeE164(body.to_number);
  if (!to) fail(400, "to_number must be E.164, for example +8801711223344.");
  if (!runtime.fromNumber) {
    fail(409, "RETELL_FROM_NUMBER is empty. Buy or import a number in Retell, bind the outbound agent, then set RETELL_FROM_NUMBER on the proxy. Web calls work without a number.");
  }
  const payload = {
    from_number: runtime.fromNumber,
    to_number: to,
    override_agent_id: runtime.outboundAgentId,
    override_agent_version: "latest_published",
    retell_llm_dynamic_variables: stringMap(body.retell_llm_dynamic_variables),
    metadata: metadataOf(body, "outbound")
  };
  const created = await retell("POST", "/v2/create-phone-call", payload, runtime);
  sendJson(res, 201, {
    provider: "retell",
    channel: "phone",
    agent_id: created.agent_id || runtime.outboundAgentId,
    call_id: created.call_id,
    call_status: created.call_status || "registered",
    from_number_configured: true,
    to_number: to
  });
}

async function handleStop(body, res, runtime) {
  requireApiKey(runtime);
  const callId = String(body.call_id || "").trim();
  if (!callId) fail(400, "call_id is required.");
  await retell("POST", "/v2/stop-call/" + encodeURIComponent(callId), null, runtime);
  sendJson(res, 200, { provider: "retell", stopped: true, call_id: callId });
}

async function handleWebhook(req, res, runtime) {
  requireApiKey(runtime);
  const raw = await readRaw(req);
  const signature = req.headers["x-retell-signature"];
  if (!verifyRetellSignature(raw, runtime.apiKey, signature)) {
    sendJson(res, 401, { error: "Invalid Retell webhook signature." });
    return;
  }
  let event = "";
  try {
    event = JSON.parse(raw).event || "";
  } catch {
    fail(400, "Webhook body is not JSON.");
  }
  sendJson(res, 204, null);
  if (!runtime.inboundForwardUrl) {
    console.log("retell webhook verified: " + event);
    return;
  }
  try {
    const forwarded = await fetch(runtime.inboundForwardUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Proxy-Secret": runtime.forwardSecret,
        "X-N8N-Secret": runtime.forwardSecret
      },
      body: raw
    });
    if (!forwarded.ok) console.error("n8n forward failed: HTTP " + forwarded.status);
  } catch (err) {
    console.error("n8n forward failed: " + err.message);
  }
}

async function retell(method, path, payload, runtime) {
  const response = await fetch(RETELL_ORIGIN + path, {
    method,
    headers: {
      Authorization: "Bearer " + runtime.apiKey,
      ...(payload ? { "Content-Type": "application/json" } : {})
    },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const text = await response.text();
  let parsed = {};
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = { message: text.slice(0, 500) }; }
  }
  if (!response.ok) {
    const message = parsed.error_message || parsed.message || parsed.error || ("Retell HTTP " + response.status);
    fail(response.status, String(message));
  }
  return parsed;
}

function metadataOf(body, agent) {
  const extra = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  return {
    source: "bdhousing",
    workspace: "BDHousing",
    org_id: ORG_ID,
    agent,
    ...extra
  };
}

function stringMap(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    out[key] = String(value);
  }
  return out;
}

function normalizeE164(value) {
  const compact = String(value || "").replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : "";
}

function requireApiKey(runtime) {
  if (!runtime.apiKey) {
    fail(500, "RETELL_API_KEY is not set on the proxy. Copy .env.example to .env and paste the bdhousing-voice key there.");
  }
}

function authorized(req, runtime) {
  if (!runtime.sharedSecret) return true;
  const got = req.headers["x-proxy-secret"] || "";
  const a = Buffer.from(String(got));
  const b = Buffer.from(runtime.sharedSecret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function originAllowed(origin, allowed) {
  if (!origin) return true;
  if (allowed.has(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function parseOrigins(value) {
  const set = new Set(["https://rabinmia975.github.io"]);
  for (const part of String(value || "").split(",")) {
    const trimmed = part.trim();
    if (trimmed) set.add(trimmed.replace(/\/$/, ""));
  }
  return set;
}

function writeCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Proxy-Secret");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(res, status, body) {
  const payload = body == null ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(payload);
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Body too large."), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const raw = await readRaw(req);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail(400, "JSON object body required.");
    return parsed;
  } catch (err) {
    if (err.statusCode) throw err;
    fail(400, "Body is not valid JSON.");
  }
}

function fail(statusCode, message) {
  throw Object.assign(new Error(message), { statusCode });
}

function loadDotEnv() {
  const candidates = [new URL("../.env", import.meta.url), new URL("./.env", import.meta.url)];
  for (const url of candidates) {
    let text = "";
    try { text = fs.readFileSync(url, "utf8"); } catch { continue; }
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

async function selfTest() {
  const key = "test-key";
  const body = '{"event":"call_started","call":{"call_id":"call_123"}}';
  const timestamp = Date.now().toString();
  const digest = crypto.createHmac("sha256", key).update(body + timestamp).digest("hex");
  const signature = `v=${timestamp},d=${digest}`;
  assert(verifyRetellSignature(body, key, signature), "valid signature accepted");
  assert(!verifyRetellSignature(body, "other-key", signature), "wrong key rejected");
  assert(!verifyRetellSignature(body, key, `v=${timestamp},d=${"ab".repeat(32)}`), "wrong digest rejected");
  assert(!verifyRetellSignature(body, key, "v=1,d=abcd"), "stale timestamp rejected");
  assert(!verifyRetellSignature('{"event":"call_started"}', key, signature), "re-serialized body rejected");

  const base = {
    inboundAgentId: INBOUND_AGENT_DEFAULT,
    outboundAgentId: OUTBOUND_AGENT_DEFAULT,
    fromNumber: "",
    sharedSecret: "proxy-secret",
    inboundForwardUrl: "",
    forwardSecret: "",
    allowedOrigins: parseOrigins("")
  };
  const locked = await listen(createHandler({ ...base, apiKey: "" }));
  const ready = await listen(createHandler({ ...base, apiKey: "test-key-not-a-real-secret" }));
  try {
    const health = await request(locked.port, "GET", "/health");
    assert(health.status === 200, "health status");
    assert(health.json.provider === "retell", "provider");
    assert(health.json.api_key_configured === false, "key flag stays boolean");
    assert(health.json.inbound_agent_id === INBOUND_AGENT_DEFAULT, "inbound id");
    assert(health.json.outbound_agent_id === OUTBOUND_AGENT_DEFAULT, "outbound id");
    assert(health.json.from_number_configured === false, "from number flag");
    assert(!JSON.stringify(health.json).includes("secret"), "health has no secret");

    const noSecret = await request(locked.port, "POST", "/v1/web-call", { body: { agent: "outbound" } });
    assert(noSecret.status === 401, "secret required");

    const noKey = await request(locked.port, "POST", "/v1/web-call", {
      body: { agent: "outbound" },
      headers: { "X-Proxy-Secret": "proxy-secret" }
    });
    assert(noKey.status === 500, "missing api key");
    assert(/RETELL_API_KEY/.test(noKey.json.error), "missing key message");

    const noConsent = await request(ready.port, "POST", "/v1/phone-call", {
      body: { to_number: "+8801711000000", consent_granted: false },
      headers: { "X-Proxy-Secret": "proxy-secret" }
    });
    assert(noConsent.status === 400, "consent required");
    assert(/consent_granted/.test(noConsent.json.error), "consent message");

    const badPhone = await request(ready.port, "POST", "/v1/phone-call", {
      body: { to_number: "01711", consent_granted: true },
      headers: { "X-Proxy-Secret": "proxy-secret" }
    });
    assert(badPhone.status === 400, "bad phone");

    const noFrom = await request(ready.port, "POST", "/v1/phone-call", {
      body: { to_number: "+8801711000000", consent_granted: true },
      headers: { "X-Proxy-Secret": "proxy-secret" }
    });
    assert(noFrom.status === 409, "missing from number");
    assert(/RETELL_FROM_NUMBER/.test(noFrom.json.error), "from number message");

    const badHook = await request(ready.port, "POST", "/v1/retell-webhook", {
      raw: body,
      headers: { "X-Retell-Signature": "v=1,d=nope" }
    });
    assert(badHook.status === 401, "bad webhook signature");

    const goodHook = await request(ready.port, "POST", "/v1/retell-webhook", {
      raw: body,
      headers: { "X-Retell-Signature": signature.replace(key, key) }
    });
    // Signature above was computed with "test-key", not the ready runtime key.
    assert(goodHook.status === 401, "webhook key must be the proxy API key");

    const matching = crypto.createHmac("sha256", "test-key-not-a-real-secret").update(body + timestamp).digest("hex");
    const accepted = await request(ready.port, "POST", "/v1/retell-webhook", {
      raw: body,
      headers: { "X-Retell-Signature": `v=${timestamp},d=${matching}` }
    });
    assert(accepted.status === 204, "valid webhook accepted");

    const evil = await request(locked.port, "OPTIONS", "/v1/web-call", { headers: { Origin: "https://evil.example" } });
    assert(evil.status === 204, "options");
    assert(!evil.headers["access-control-allow-origin"], "evil origin blocked");

    const pages = await request(locked.port, "POST", "/v1/web-call", {
      body: {},
      headers: { Origin: "https://rabinmia975.github.io", "X-Proxy-Secret": "nope" }
    });
    assert(pages.status === 401, "bad secret");
    assert(pages.headers["access-control-allow-origin"] === "https://rabinmia975.github.io", "pages origin allowed");
  } finally {
    await locked.close();
    await ready.close();
  }
  console.log("retell-proxy self-test passed");
}

function assert(condition, message) {
  if (!condition) throw new Error("self-test failed: " + message);
}

function listen(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        port: address.port,
        close: () => new Promise((done, fail) => server.close((err) => err ? fail(err) : done()))
      });
    });
  });
}

function request(port, method, path, options = {}) {
  const payload = options.raw != null ? options.raw : (options.body != null ? JSON.stringify(options.body) : null);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      method,
      path,
      headers: {
        ...(payload != null ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(options.headers || {})
      }
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
        resolve({ status: res.statusCode, headers: res.headers, json });
      });
    });
    req.on("error", reject);
    if (payload != null) req.write(payload);
    req.end();
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain && process.argv.includes("--self-test")) {
  selfTest().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (isMain) {
  const server = http.createServer(createHandler(config));
  server.listen(config.port, () => {
    console.log("BDHousing Retell proxy on :" + config.port + " provider=retell api_key_configured=" + Boolean(config.apiKey));
  });
}
