-- What Mile photo metadata table
-- This file documents the schema — run it manually in the Supabase SQL editor.

create table photos (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique,
  filename      text unique not null,
  r2_url        text not null,
  location_name text not null,
  lat           double precision not null,
  lng           double precision not null,
  description   text,
  status        text not null default 'pending'
                check (status in ('pending', 'review', 'approved', 'skip')),
  source        text not null default 'owner'
                check (source in ('owner', 'community')),
  created_at    timestamptz not null default now()
);

-- Row Level Security: only approved photos are readable by the anon key.
-- This ensures the browser client can never see pending, review, or skipped photos,
-- even if someone inspects network requests or crafts custom Supabase queries.
create policy "Public read approved photos"
  on photos for select
  using (status = 'approved');

alter table photos enable row level security;

-- Indexes for common queries
create index photos_status_idx on photos (status);
create index photos_created_at_idx on photos (created_at desc);
