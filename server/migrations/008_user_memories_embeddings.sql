-- Semantic (embedding-based) memory recall — replaces the ts_rank/tsvector
-- full-text approach in match_user_memories with cosine similarity over a
-- self-hosted 384-dim embedding (Xenova/all-MiniLM-L6-v2, computed
-- in-process in bb-server via server/embeddings.js — no external embedding
-- API, no per-token cost, conversation content never leaves this server).
-- Run via Supabase SQL Editor or psql

create extension if not exists vector;

alter table user_memories add column if not exists embedding vector(384);

-- No approximate-search index (ivfflat/hnsw) yet, deliberately. Tried
-- ivfflat(lists=100) first — at today's ~3.4K rows that's ~34 rows/list, and
-- with the default probes=1 a genuinely novel query only has a ~1% chance of
-- hitting the right list: verified this empirically, an exact-duplicate query
-- matched fine (its own list) but a realistic novel query returned nothing
-- out of thousands of candidates. A brute-force scan is both correct (exact
-- nearest neighbor, no recall loss) and fast enough at this size — add an
-- index back (ivfflat needs a real row count to cluster well; hnsw doesn't
-- have that footgun but costs more to build/maintain) once the table is
-- meaningfully bigger and a seq scan actually shows up as a cost.

-- The old function took (match_user_id text, query_text text, match_count int)
-- and ranked via plainto_tsquery. Different signature, so drop it explicitly
-- rather than leave a dead overload with the same name sitting next to the
-- new one.
drop function if exists match_user_memories(text, text, int);

create or replace function match_user_memories(
  match_user_id text,
  query_embedding vector(384),
  match_count int default 10
)
returns table (
  id uuid,
  content text,
  type text,
  similarity float,
  created_at timestamptz
)
language plpgsql
as $$
begin
  return query
  select
    um.id,
    um.content,
    um.type,
    (1 - (um.embedding <=> query_embedding))::float as similarity,
    um.created_at
  from user_memories um
  where um.user_id = match_user_id
    and um.embedding is not null
  order by um.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- search_vector / its GIN index (002_user_memories.sql) are left in place,
-- unused by the app from here on — inert, not worth the churn of a drop.
