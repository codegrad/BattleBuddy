// GET /api/v1/ledger/balance — builder-scoped ledger balance.
// Cloudflare Pages Function: this file IS the route (functions/api/v1/ledger/balance.js).
// Read-only: SELECT only, matching the append-only ledger_entry table.
// Identity comes from a VERIFIED sp_session, never from the raw cookie.

import { verifySession } from '../../../_lib/session.js';

const SESSION_COOKIE = 'sp_session';
const DEFAULT_CURRENCY = 'SPC';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function unauthorized() {
  return json({ ok: false, error: 'no_builder_session' }, 401);
}

function readCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    const value = part.slice(idx + 1).trim();
    return value.length ? decodeURIComponent(value) : null;
  }
  return null;
}

// Returns a builder id ONLY when the session signature verifies.
// A missing, malformed, unsigned, or forged cookie yields null -> 401.
async function verifiedBuilderId(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  let session;
  try {
    session = await verifySession(token, env.SESSION_SECRET);
  } catch (_) {
    return null;
  }
  if (!session) return null;

  const id = session.builder_id || session.builderId;
  return typeof id === 'string' && id.length ? id : null;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const builderId = await verifiedBuilderId(request, env);
  if (!builderId) return unauthorized();

  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS balance
       FROM ledger_entry
      WHERE builder_id = ?`
  )
    .bind(builderId)
    .first();

  return json({
    ok: true,
    builder_id: builderId,
    balance: Number(row?.balance ?? 0),
    currency: DEFAULT_CURRENCY,
  });
}
