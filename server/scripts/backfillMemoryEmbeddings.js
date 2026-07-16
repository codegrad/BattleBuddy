/**
 * One-time backfill: computes embeddings for every existing user_memories
 * row that predates the pgvector migration (008_user_memories_embeddings.sql)
 * and therefore has embedding IS NULL — otherwise those rows are invisible
 * to the new cosine-similarity match_user_memories RPC.
 *
 * Unlike migrateProfilesToSupabase.js, this needs no Railway-volume access —
 * it only reads/writes the shared Supabase user_memories table — so it runs
 * directly from a dev machine rather than through a temporary admin endpoint.
 *
 * Safe to re-run: each page only selects rows still missing an embedding.
 *
 * Usage: node server/scripts/backfillMemoryEmbeddings.js
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { embed } from '../embeddings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = resolve(__dirname, '..', '.env');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) process.env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
} catch {}

const PAGE_SIZE = 200;

export async function runBackfill() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.log('[EmbeddingBackfill] SUPABASE_URL / SUPABASE_SERVICE_KEY not set, aborting');
    return { embedded: 0, failed: 0 };
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: { transport: WebSocket },
  });

  let embedded = 0;
  let failed = 0;

  for (;;) {
    const { data: rows, error } = await supabase
      .from('user_memories')
      .select('id, content')
      .is('embedding', null)
      .limit(PAGE_SIZE);

    if (error) {
      console.error('[EmbeddingBackfill] Failed to read a page:', error.message);
      break;
    }
    if (!rows || rows.length === 0) break;

    // Plain per-row UPDATE, not upsert — upsert's ON CONFLICT DO UPDATE still
    // needs the full row's NOT NULL columns satisfied in the same statement
    // even though only the conflict path is taken, so a {id, embedding}-only
    // payload doesn't work. UPDATE has no such requirement. Fired with modest
    // concurrency so ~3.4K rows don't take one round-trip each in sequence.
    const CONCURRENCY = 10;
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const batch = rows.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(async row => {
        try {
          const embedding = await embed(row.content || '');
          const { error: updateError } = await supabase.from('user_memories').update({ embedding }).eq('id', row.id);
          if (updateError) throw new Error(updateError.message);
          return true;
        } catch (e) {
          console.error(`[EmbeddingBackfill] Failed on row ${row.id}:`, e.message);
          return false;
        }
      }));
      embedded += results.filter(Boolean).length;
      failed += results.filter(r => !r).length;
      console.log(`[EmbeddingBackfill] Embedded ${embedded} row(s) so far...`);
    }

    // Last page was smaller than PAGE_SIZE — nothing left to fetch.
    if (rows.length < PAGE_SIZE) break;
  }

  console.log(`[EmbeddingBackfill] Done. Embedded ${embedded} row(s), ${failed} failure(s).`);
  return { embedded, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBackfill().then(() => process.exit(0)).catch(err => {
    console.error('[EmbeddingBackfill] Fatal error:', err.message);
    process.exit(1);
  });
}
