-- =============================================
-- HORIC AUTOS — RAG Knowledge Base Schema
-- Run this AFTER migration.sql in Supabase SQL Editor
-- =============================================

-- Enable pgvector extension
create extension if not exists vector;

-- KNOWLEDGE BASE TABLE with embeddings
create table if not exists knowledge_base (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  content_type text not null default 'faq',
  metadata jsonb default '{}'::jsonb,
  embedding vector(768),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast similarity search
create index on knowledge_base using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Content type index for filtering
create index idx_knowledge_base_type on knowledge_base (content_type);

-- Enable RLS
alter table knowledge_base enable row level security;

-- Public can read knowledge base (for RAG search)
create policy "Public can read knowledge base"
  on knowledge_base for select
  using (true);

-- Authenticated can manage knowledge base
create policy "Authenticated can insert knowledge base"
  on knowledge_base for insert
  to authenticated
  with check (true);

create policy "Authenticated can update knowledge base"
  on knowledge_base for update
  to authenticated
  using (true);

create policy "Authenticated can delete knowledge base"
  on knowledge_base for delete
  to authenticated
  using (true);

-- SIMILARITY SEARCH FUNCTION
-- Returns top-k most relevant knowledge base entries for a query embedding
create or replace function match_knowledge_base(
  query_embedding vector(768),
  match_count int default 5,
  match_threshold float default 0.3,
  filter_type text default null
)
returns table (
  id uuid,
  content text,
  content_type text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    kb.id,
    kb.content,
    kb.content_type,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) as similarity
  from knowledge_base kb
  where
    (filter_type is null or kb.content_type = filter_type)
    and 1 - (kb.embedding <=> query_embedding) > match_threshold
  order by kb.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- AUTO-UPDATE TRIGGER for updated_at
create or replace function update_knowledge_base_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger knowledge_base_updated_at
  before update on knowledge_base
  for each row
  execute function update_knowledge_base_timestamp();
