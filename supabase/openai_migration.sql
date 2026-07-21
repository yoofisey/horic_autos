-- Run this in Neon SQL Editor to switch from Gemini (768) to OpenAI (1536) embeddings

-- Drop old knowledge base and recreate with correct vector size
drop table if exists knowledge_base cascade;

create table knowledge_base (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  content_type text not null default 'faq',
  metadata jsonb default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_knowledge_type on knowledge_base (content_type);
create index idx_knowledge_embedding on knowledge_base using ivfflat (embedding vector_cosine_ops) with (lists = 50);

-- RAG search function (updated for 1536 dimensions)
create or replace function match_knowledge_base(
  query_embedding vector(1536),
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

create trigger knowledge_base_updated_at
  before update on knowledge_base
  for each row execute function update_timestamp();
