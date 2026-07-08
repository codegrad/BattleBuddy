/**
 * Admin console API — lets the founder tune the agent's behavior from a web UI
 * (served at GET /admin/console) without a coding session:
 *
 *   - System prompt: view/edit server/prompts/system.battlebuddy.md. Writes go
 *     live on the next turn (the prompt is read fresh per request). An edit
 *     survives until the next deploy unless committed — POST with commit: true
 *     reuses the agentDesignLoop git pattern to make it durable.
 *   - Resources: reference documents (research, frameworks) stored on the
 *     Railway volume and injected into every prompt (see buildAdminInjections
 *     in contextAgent.js).
 *   - Directives: short behavioral instructions with optional expiry dates,
 *     injected above the persona so they override conflicting guidance.
 *   - Insights: transcript-audit reports (wins/failures/proposals with
 *     verbatim evidence) read from bb_events, plus an on-demand analysis run.
 *
 * All data routes require the x-bb-admin-secret header (checkAdminSecret is
 * passed in from index.js). Only the HTML shell is open — same rationale as
 * GET /admin: a browser navigation can't attach custom headers.
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, execFileSync } from 'node:child_process';
import { ADMIN_DATA_ROOT, RESOURCES_DIR, DIRECTIVES_PATH, loadDirectives, isDirectiveActive } from './contextAgent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const systemPromptPath = resolve(__dirname, 'prompts', 'system.battlebuddy.md');
const consoleHtmlPath = resolve(__dirname, 'admin-console.html');
const PROMPT_BACKUPS_DIR = resolve(ADMIN_DATA_ROOT, 'prompt-backups');
const MAX_PROMPT_BACKUPS = 20;

// Every one of these must survive a prompt edit — buildSystemPrompt fills them
// per turn, and .replace() silently no-ops on a missing placeholder, so losing
// {{profile}} would quietly erase the agent's memory of the user.
const REQUIRED_PLACEHOLDERS = [
  '{{current_goal}}', '{{profile}}', '{{trigger_context}}', '{{recent_history}}',
  '{{life_architecture}}', '{{session_context}}', '{{relevant_memories}}',
];

const MAX_DIRECTIVE_CHARS = 500;
const MAX_RESOURCE_CHARS = 200000;

function json(res, CORS, status, payload) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
}

/** Map a client-supplied resource name to a safe path inside RESOURCES_DIR.
 * Returns null if the name is empty after sanitizing or escapes the dir. */
function resourcePath(rawName) {
  const cleaned = basename(String(rawName || '')).replace(/[^a-zA-Z0-9 ()&+',._-]/g, '').trim();
  if (!cleaned || cleaned.startsWith('.')) return null;
  const withExt = /\.[a-zA-Z0-9]+$/.test(cleaned) ? cleaned : `${cleaned}.md`;
  const path = resolve(RESOURCES_DIR, withExt);
  if (!path.startsWith(RESOURCES_DIR + sep)) return null;
  return { path, name: withExt };
}

function saveDirectives(list) {
  mkdirSync(ADMIN_DATA_ROOT, { recursive: true });
  writeFileSync(DIRECTIVES_PATH, JSON.stringify(list, null, 2));
}

/** Timestamped copy of the current prompt onto the volume before every
 * overwrite, pruned to the newest MAX_PROMPT_BACKUPS. The container file is
 * ephemeral; these survive redeploys. */
function backupPrompt() {
  mkdirSync(PROMPT_BACKUPS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  writeFileSync(resolve(PROMPT_BACKUPS_DIR, `system.battlebuddy.${stamp}.md`), readFileSync(systemPromptPath, 'utf-8'));
  const backups = readdirSync(PROMPT_BACKUPS_DIR).filter(f => f.endsWith('.md')).sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - MAX_PROMPT_BACKUPS))) {
    try { unlinkSync(resolve(PROMPT_BACKUPS_DIR, old)); } catch {}
  }
}

/** Same pattern as agentDesignLoop.commitAndPush — makes a console edit
 * survive redeploys by pushing it back to the repo Railway deploys from. */
function commitPromptToGit() {
  const repoRoot = resolve(__dirname, '..');
  execSync('git add server/prompts/system.battlebuddy.md', { cwd: repoRoot });
  execFileSync('git', ['commit', '-m', 'chore: system prompt edited via admin console'], { cwd: repoRoot });
  execSync('git push origin main', { cwd: repoRoot });
}

export async function handleAdminConsole(req, res, { checkAdminSecret, CORS, send401, runTranscriptAudit, fetchAuditReports }) {
  const url = req.url.split('?')[0];

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...CORS, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' });
    return res.end();
  }

  // HTML shell — open (carries no data; scripts inside prompt for the secret).
  if (req.method === 'GET' && url === '/admin/console') {
    const html = readFileSync(consoleHtmlPath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(html);
  }

  if (!checkAdminSecret(req)) return send401(res, 401, 'Unauthorized');

  try {
    // ─── System prompt ────────────────────────────────────────────────────
    if (req.method === 'GET' && url === '/admin/console/prompt') {
      const content = readFileSync(systemPromptPath, 'utf-8');
      return json(res, CORS, 200, { content, chars: content.length });
    }

    if (req.method === 'POST' && url === '/admin/console/prompt') {
      const { content, commit, force } = JSON.parse(await readBody(req));
      if (typeof content !== 'string' || content.trim().length < 200) {
        return json(res, CORS, 400, { error: 'Prompt content missing or suspiciously short — refusing to save.' });
      }
      const missing = REQUIRED_PLACEHOLDERS.filter(p => !content.includes(p));
      if (missing.length > 0 && !force) {
        return json(res, CORS, 400, {
          error: `Missing required placeholders: ${missing.join(', ')}. These are filled per turn — removing them silently breaks context injection. Re-send with force: true to save anyway.`,
          missing,
        });
      }
      backupPrompt();
      writeFileSync(systemPromptPath, content);
      console.log(`[AdminConsole] System prompt saved (${content.length} chars) — live on next turn`);

      let committed = false, commitError = null;
      if (commit) {
        try {
          commitPromptToGit();
          committed = true;
          console.log('[AdminConsole] Prompt edit committed and pushed');
        } catch (e) {
          commitError = e.message;
          console.warn('[AdminConsole] Prompt git commit failed:', e.message);
        }
      }
      return json(res, CORS, 200, { ok: true, chars: content.length, committed, commitError });
    }

    // ─── Resources ────────────────────────────────────────────────────────
    if (req.method === 'GET' && url === '/admin/console/resources') {
      let resources = [];
      try {
        resources = readdirSync(RESOURCES_DIR)
          .filter(f => !f.startsWith('.'))
          .sort()
          .map(name => {
            const st = statSync(resolve(RESOURCES_DIR, name));
            return { name, size: st.size, modifiedAt: st.mtime.toISOString() };
          });
      } catch {} // dir doesn't exist yet
      return json(res, CORS, 200, { resources });
    }

    if (req.method === 'POST' && url === '/admin/console/resources') {
      const { name, content } = JSON.parse(await readBody(req));
      const target = resourcePath(name);
      if (!target) return json(res, CORS, 400, { error: 'Invalid resource name.' });
      if (typeof content !== 'string' || !content.trim()) {
        return json(res, CORS, 400, { error: 'Resource content is empty.' });
      }
      if (content.length > MAX_RESOURCE_CHARS) {
        return json(res, CORS, 400, { error: `Resource too large (${content.length} chars, max ${MAX_RESOURCE_CHARS}).` });
      }
      mkdirSync(RESOURCES_DIR, { recursive: true });
      const existed = existsSync(target.path);
      writeFileSync(target.path, content);
      console.log(`[AdminConsole] Resource ${existed ? 'updated' : 'added'}: ${target.name} (${content.length} chars)`);
      return json(res, CORS, 200, { ok: true, name: target.name, updated: existed });
    }

    const resourceMatch = url.match(/^\/admin\/console\/resources\/(.+)$/);
    if (resourceMatch) {
      const target = resourcePath(decodeURIComponent(resourceMatch[1]));
      if (!target || !existsSync(target.path)) return json(res, CORS, 404, { error: 'Resource not found.' });
      if (req.method === 'GET') {
        return json(res, CORS, 200, { name: target.name, content: readFileSync(target.path, 'utf-8') });
      }
      if (req.method === 'DELETE') {
        unlinkSync(target.path);
        console.log(`[AdminConsole] Resource deleted: ${target.name}`);
        return json(res, CORS, 200, { ok: true });
      }
    }

    // ─── Directives ───────────────────────────────────────────────────────
    if (req.method === 'GET' && url === '/admin/console/directives') {
      const directives = loadDirectives().map(d => ({ ...d, active: isDirectiveActive(d) }));
      return json(res, CORS, 200, { directives });
    }

    if (req.method === 'POST' && url === '/admin/console/directives') {
      const { text, expires } = JSON.parse(await readBody(req));
      const trimmed = String(text || '').trim();
      if (!trimmed) return json(res, CORS, 400, { error: 'Directive text is empty.' });
      if (trimmed.length > MAX_DIRECTIVE_CHARS) {
        return json(res, CORS, 400, { error: `Directives are short instructions — max ${MAX_DIRECTIVE_CHARS} chars. Longer material belongs in Resources.` });
      }
      if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
        return json(res, CORS, 400, { error: 'Expiry must be YYYY-MM-DD.' });
      }
      const directive = {
        id: `d-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        text: trimmed,
        expires: expires || null,
        createdAt: new Date().toISOString(),
      };
      saveDirectives([...loadDirectives(), directive]);
      console.log(`[AdminConsole] Directive added: "${trimmed.slice(0, 60)}"${expires ? ` (expires ${expires})` : ''}`);
      return json(res, CORS, 200, { ok: true, directive: { ...directive, active: isDirectiveActive(directive) } });
    }

    // ─── Insights (transcript-audit recommendations) ──────────────────────
    // Reuses the existing audit engine (runTranscriptAudit in index.js) —
    // one analysis pipeline, surfaced here so Mike can read the reports and
    // trigger a fresh pass without waiting for the hourly sweep.
    if (req.method === 'GET' && url === '/admin/console/insights') {
      return json(res, CORS, 200, await fetchAuditReports(15));
    }

    if (req.method === 'POST' && url === '/admin/console/insights/run') {
      const body = await readBody(req);
      const { days } = body ? JSON.parse(body) : {};
      const windowDays = Math.min(Math.max(Number(days) || 1, 1), 30);
      const sinceMs = Date.now() - windowDays * 24 * 3600 * 1000;
      console.log(`[AdminConsole] On-demand transcript analysis over last ${windowDays} day(s)`);
      const result = await runTranscriptAudit(sinceMs, 'admin_console');
      return json(res, CORS, 200, { ...result, windowDays });
    }

    const directiveMatch = url.match(/^\/admin\/console\/directives\/([\w-]+)$/);
    if (req.method === 'DELETE' && directiveMatch) {
      const list = loadDirectives();
      const remaining = list.filter(d => d.id !== directiveMatch[1]);
      if (remaining.length === list.length) return json(res, CORS, 404, { error: 'Directive not found.' });
      saveDirectives(remaining);
      console.log(`[AdminConsole] Directive deleted: ${directiveMatch[1]}`);
      return json(res, CORS, 200, { ok: true });
    }

    return json(res, CORS, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[AdminConsole] Error:', err.message);
    return json(res, CORS, 500, { error: err.message });
  }
}
