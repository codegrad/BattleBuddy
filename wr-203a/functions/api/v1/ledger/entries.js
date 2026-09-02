// GET /api/v1/ledger/entries — builder-scoped ledger entries, newest first.
// Cloudflare Pages Function: this file IS the route (functions/api/v1/ledger/entries.js).
// Read-only: SELECT only, matching the append-only ledger_entry table.
// Identity comes from a VERIFIED sp_session, never from the raw cookie.

import { verifySession } from '../../../_lib/session.js';

const SESSION_COOKIE = 'sp_session';
const ENTRIES_LIMIT = 200;

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

  const { results } = await env.DB.prepare(
    `SELECT id, room_id, wr_id, amount, kind, created_at
       FROM ledger_entry
      WHERE builder_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?`
  )
    .bind(builderId, ENTRIES_LIMIT)
    .all();

  const entries = (results || []).map((r) => ({
    id: r.id,
    room_id: r.room_id,
    wr_id: r.wr_id,
    amount: Number(r.amount),
    kind: r.kind,
    created_at: r.created_at,
  }));

  // No pagination in v1: `more` is always false, but always present.
  return json({ ok: true, entries, more: false });
}
