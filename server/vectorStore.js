/**
 * Vector Store — Postgres pgvector-backed semantic memory for BattleBuddy.
 *
 * Stores observations, triggers, session summaries, and insights into a
 * Supabase `user_memories` table, embedded via server/embeddings.js
 * (self-hosted, in-process — see that file for why). Retrieval ranks by
 * cosine similarity (match_user_memories RPC) instead of keyword overlap,
 * so a query surfaces memories that resemble it in meaning, not just ones
 * sharing literal words.
 */

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { resolveUserId } from './contextAgent.js';
import { embed } from './embeddings.js';

let supabase = null;
let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (supabaseUrl && supabaseKey) {
    // Node 20 has no native WebSocket global; supabase-js's realtime client
    // requires one at construction even though we only use REST/RPC calls.
    // Without this, createClient throws and the vector store is dead for the
    // life of the process (initialized=true, supabase=null).
    supabase = createClient(supabaseUrl, supabaseKey, {
      realtime: { transport: WebSocket },
    });
  }
}

/**
 * Store a piece of content for a user.
 * @param {string} userId
 * @param {string} content - The text to store
 * @param {string} type - 'observation' | 'trigger' | 'session_summary' | 'insight'
 * @param {string} [sessionId] - Optional session identifier
 */
export async function embedAndStore(userId, content, type, sessionId = null) {
  init();
  if (!supabase) return;
  if (!content || content.length < 10) return;

  // Canonicalize here, not at each call site — a caller that forgets to
  // resolve aliases silently writes memories under an ID retrieveRelevant()
  // will never query for again. See the removed /admin/backfill-transcripts
  // endpoint, which did exactly that.
  const canonicalUserId = resolveUserId(userId);

  try {
    const embedding = await embed(content);
    const { error } = await supabase.from('user_memories').insert({
      user_id: canonicalUserId,
      content,
      type,
      embedding,
    });
    if (error) {
      console.error('[VectorStore] Insert failed:', error.message);
    } else {
      console.log(`[VectorStore] Stored ${type} for ${canonicalUserId} (${content.length} chars)`);
    }
  } catch (err) {
    console.error('[VectorStore] Store failed:', err.message);
  }
}

/**
 * Retrieve the most relevant stored memories for a user given a query.
 * @param {string} userId
 * @param {string} queryText - Current context to match against
 * @param {number} [limit=10]
 * @returns {Array<{content: string, type: string, similarity: number, created_at: string}>}
 */
export async function retrieveRelevant(userId, queryText, limit = 10) {
  init();
  if (!supabase) return [];
  if (!queryText || queryText.length < 3) return [];

  const canonicalUserId = resolveUserId(userId);

  try {
    const queryEmbedding = await embed(queryText);
    const { data, error } = await supabase.rpc('match_user_memories', {
      match_user_id: canonicalUserId,
      query_embedding: queryEmbedding,
      match_count: limit,
    });

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('[VectorStore] user_memories table not yet created, returning empty');
        return [];
      }
      console.error('[VectorStore] Retrieval failed:', error.message);
      return [];
    }

    console.log(`[VectorStore] Retrieved ${data?.length || 0} memories for ${canonicalUserId}`);
    return data || [];
  } catch (err) {
    console.error('[VectorStore] Retrieve failed:', err.message);
    return [];
  }
}

/**
 * Check if the vector store is configured and ready.
 */
export function isConfigured() {
  init();
  return !!supabase;
}
