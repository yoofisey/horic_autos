-- =============================================
-- HORIC AUTOS — Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- VEHICLES TABLE
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
  created_at text not null default (now()::text),
  updated_at text not null default (now()::text),
  views integer default 0,
  enquiries integer default 0
);

-- ENQUIRIES TABLE
create table if not exists enquiries (
  id text primary key,
  vehicle_id text references vehicles(id) on delete set null,
  customer_name text not null default 'Anonymous',
  customer_phone text default '',
  customer_email text default '',
  message text default '',
  status text not null default 'unread',
  created_at text not null default (now()::text)
);

-- ENABLE ROW LEVEL SECURITY
alter table vehicles enable row level security;
alter table enquiries enable row level security;

-- PUBLIC READ ACCESS (anyone can view vehicles & enquiries)
create policy "Public can view vehicles"
  on vehicles for select
  using (true);

create policy "Public can view enquiries"
  on enquiries for select
  using (true);

-- AUTHENTICATED WRITE ACCESS (only logged-in admins can modify)
create policy "Authenticated can insert vehicles"
  on vehicles for insert
  to authenticated
  with check (true);

create policy "Authenticated can update vehicles"
  on vehicles for update
  to authenticated
  using (true);

create policy "Authenticated can delete vehicles"
  on vehicles for delete
  to authenticated
  using (true);

create policy "Authenticated can insert enquiries"
  on enquiries for insert
  to authenticated
  with check (true);

create policy "Authenticated can update enquiries"
  on enquiries for update
  to authenticated
  using (true);

create policy "Authenticated can delete enquiries"
  on enquiries for delete
  to authenticated
  using (true);

-- STORAGE BUCKET for vehicle images
insert into storage.buckets (id, name, public)
values ('vehicle-images', 'vehicle-images', true)
on conflict (id) do nothing;

-- Public can read vehicle images
create policy "Public can view vehicle images"
  on storage.objects for select
  using (bucket_id = 'vehicle-images');

-- Authenticated can upload vehicle images
create policy "Authenticated can upload vehicle images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'vehicle-images');

-- Authenticated can delete vehicle images
create policy "Authenticated can delete vehicle images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'vehicle-images');
