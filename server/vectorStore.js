/**
 * Vector Store — pgvector-backed semantic memory for BattleBuddy.
 *
 * Embeds observations, triggers, session summaries, and insights into
 * Supabase pgvector. At session startup, retrieves the most relevant
 * memories for the current context instead of dumping the full profile.
 *
 * Uses OpenAI text-embedding-3-small ($0.02/1M tokens — effectively free).
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

let supabase = null;
let openai = null;
let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }

  if (openaiKey) {
    openai = new OpenAI({ apiKey: openaiKey });
  }
}

/**
 * Generate an embedding for a text string.
 */
async function embed(text) {
  init();
  if (!openai) {
    console.log('[VectorStore] No OPENAI_API_KEY configured, skipping embedding');
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('[VectorStore] Embedding failed:', err.message);
    return null;
  }
}

/**
 * Embed and store a piece of content for a user.
 * @param {string} userId
 * @param {string} content - The text to embed
 * @param {string} type - 'observation' | 'trigger' | 'session_summary' | 'insight'
 * @param {string} [sessionId] - Optional session identifier
 */
export async function embedAndStore(userId, content, type, sessionId = null) {
  init();
  if (!supabase || !openai) return;
  if (!content || content.length < 10) return;

  const embedding = await embed(content);
  if (!embedding) return;

  try {
    const { error } = await supabase.from('user_embeddings').insert({
      user_id: userId,
      content,
      embedding,
      type,
      session_id: sessionId,
    });
    if (error) {
      console.error('[VectorStore] Insert failed:', error.message);
    } else {
      console.log(`[VectorStore] Stored ${type} for ${userId} (${content.length} chars)`);
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
  if (!supabase || !openai) return [];

  const queryEmbedding = await embed(queryText);
  if (!queryEmbedding) return [];

  try {
    const { data, error } = await supabase.rpc('match_user_embeddings', {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_count: limit,
      match_threshold: 0.5,
    });

    if (error) {
      console.error('[VectorStore] Retrieval failed:', error.message);
      return [];
    }

    console.log(`[VectorStore] Retrieved ${data?.length || 0} memories for ${userId}`);
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
  return !!(supabase && openai);
}
