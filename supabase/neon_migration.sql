-- =============================================
-- HORIC AUTOS — Neon PostgreSQL Schema
-- Run this in the Neon SQL Editor (or psql)
-- =============================================

-- Enable pgvector extension
create extension if not exists vector;

-- ─────────────────────────────────
-- ADMINS TABLE (for JWT auth)
-- ─────────────────────────────────
create table if not exists admins (
  id serial primary key,
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- Insert default admin (password: horic_admin_2025)
-- IMPORTANT: Change this password in production!
-- To generate a new hash, run in Node.js:
--   const bcrypt = require('bcryptjs');
--   console.log(bcrypt.hashSync('your_password', 10));
insert into admins (email, password_hash)
values ('admin@horicautos.com', '$2a$10$8K1p/a0dL1LXMc.0zL5q4OzQhNzGxVZbQxK5Y5Y5Y5Y5Y5Y5Y5Y5')
on conflict (email) do nothing;

-- ─────────────────────────────────
-- VEHICLES TABLE
-- ─────────────────────────────────
create table if not exists vehicles (
  id text primary key,
  make text not null default '',
  model text not null default '',
  year integer not null default 2024,
  price numeric not null default 0,
  condition text not null default 'new',
  status text not null default 'in_stock',
  body_type text not null default 'sedan',
  fuel text not null default 'petrol',
  mileage integer not null default 0,
  engine text default '',
  transmission text not null default 'automatic',
  color text default '',
  description text default '',
  features jsonb default '[]'::jsonb,
  images jsonb default '[]'::jsonb,
  sold_price numeric,
  sold_date text,
  sold_to text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  views integer default 0,
  enquiries integer default 0
);

-- ─────────────────────────────────
-- ENQUIRIES TABLE
-- ─────────────────────────────────
create table if not exists enquiries (
  id text primary key,
  vehicle_id text references vehicles(id) on delete set null,
  customer_name text not null default 'Anonymous',
  customer_phone text default '',
  customer_email text default '',
  message text default '',
  status text not null default 'unread',
  created_at timestamptz default now()
);

-- ─────────────────────────────────
-- KNOWLEDGE BASE (RAG)
-- ─────────────────────────────────
create table if not exists knowledge_base (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  content_type text not null default 'faq',
  metadata jsonb default '{}'::jsonb,
  embedding vector(768),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_vehicles_status on vehicles (status);
create index if not exists idx_enquiries_status on enquiries (status);
create index if not exists idx_knowledge_type on knowledge_base (content_type);
create index if not exists idx_knowledge_embedding on knowledge_base using ivfflat (embedding vector_cosine_ops) with (lists = 50);

-- ─────────────────────────────────
-- RAG SEARCH FUNCTION
-- ─────────────────────────────────
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

-- ─────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────
create or replace function update_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger vehicles_updated_at
  before update on vehicles
  for each row execute function update_timestamp();

create trigger knowledge_base_updated_at
  before update on knowledge_base
  for each row execute function update_timestamp();
