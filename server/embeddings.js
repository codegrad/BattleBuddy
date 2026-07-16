/**
 * Local, self-hosted text embeddings for semantic memory recall.
 *
 * Runs Xenova/all-MiniLM-L6-v2 (384-dim, ~90MB) in-process via
 * @huggingface/transformers (ONNX runtime, WASM/native backend) — no
 * external embedding API, no per-token cost, no rate limits, and
 * conversation content (sensitive addiction/health data) never leaves this
 * server. Fine-grained retrieval quality trails a hosted model like OpenAI's
 * or Voyage's, but at this user count that's very unlikely to matter for
 * "does this past memory resemble what's happening now" style recall.
 */

import { pipeline, env } from '@huggingface/transformers';
import { resolve } from 'node:path';
import { ADMIN_DATA_ROOT } from './contextAgent.js';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIM = 384;

// Cache model weights on the Railway volume (same root as everything else
// that must survive a redeploy) so the ~90MB download happens once, not on
// every boot of an ephemeral container.
env.cacheDir = resolve(ADMIN_DATA_ROOT, 'models');

let embedderPromise = null;
function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline('feature-extraction', MODEL_ID).catch(err => {
      embedderPromise = null; // let the next call retry instead of caching a permanent failure
      throw err;
    });
  }
  return embedderPromise;
}

// Start loading immediately at import time (not awaited — this must not
// block server boot) so the model is warm before the first real request
// needs it. fetchRelevantMemories's existing 800ms race in index.js already
// degrades gracefully (returns no memories that turn) if it isn't ready yet.
getEmbedder()
  .then(() => console.log('[Embeddings] Model warmed and ready'))
  .catch(err => console.error('[Embeddings] Failed to warm model:', err.message));

/**
 * Embed text into a 384-dim, L2-normalized vector — normalized so cosine
 * similarity in Postgres (pgvector's <=> operator) is well-defined and
 * stable. Longer inputs are truncated to the model's 256-token window by
 * the tokenizer; fine for the short insight/trigger/summary strings this
 * store holds today.
 */
export async function embed(text) {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
