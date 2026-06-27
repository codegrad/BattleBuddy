-- pgvector foundation for semantic memory retrieval
-- Run via Supabase SQL Editor or psql

create extension if not exists vector;

create table if not exists user_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  content text not null,
  embedding vector(1536),
  type text, -- 'observation' | 'trigger' | 'session_summary' | 'insight'
  created_at timestamptz default now(),
  session_id text
);

-- ivfflat index requires rows to exist first; create after initial data load
-- For small-scale usage (<10K rows), exact search is fine. Add this when scaling:
-- create index on user_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- For initial use: exact nearest-neighbor via cosine distance
create index if not exists user_embeddings_user_id_idx on user_embeddings (user_id);
create index if not exists user_embeddings_type_idx on user_embeddings (type);

-- Helper function for similarity search
create or replace function match_user_embeddings(
  query_embedding vector(1536),
  match_user_id text,
  match_count int default 10,
  match_threshold float default 0.7
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
    ue.id,
    ue.content,
    ue.type,
    1 - (ue.embedding <=> query_embedding) as similarity,
    ue.created_at
  from user_embeddings ue
  where ue.user_id = match_user_id
    and 1 - (ue.embedding <=> query_embedding) > match_threshold
  order by ue.embedding <=> query_embedding
  limit match_count;
end;
$$;
