-- What Mile photo metadata table
-- This file documents the full schema — run it manually in the Supabase SQL editor for new databases.
-- For existing databases, use schema-v2.sql migration instead.

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
  created_at    timestamptz not null default now(),
  taken_at      timestamptz,      -- EXIF timestamp, powers seasonal browsing
  trail_section text,             -- State or named section (e.g. "Georgia"), powers geographic filtering
  times_shown   integer not null default 0,    -- Game appearance count, powers difficulty balancing
  avg_score     double precision, -- Running average player score, powers difficulty analytics
  is_private    boolean not null default false -- Whether photo is in private bucket (pipeline) vs public bucket (approved)
);

-- Row Level Security
alter table photos enable row level security;

-- Public anon key can only read approved photos
-- This ensures the browser client can never see pending, review, or skipped photos,
-- even if someone inspects network requests or crafts custom Supabase queries.
create policy "Public read approved photos"
  on photos for select
  to anon
  using (status = 'approved');

-- Authenticated admin users can read all photos regardless of status
create policy "Admin read all photos"
  on photos for select
  to authenticated
  using (true);

-- Authenticated admin users can insert new photos
create policy "Admin insert photos"
  on photos for insert
  to authenticated
  with check (true);

-- Authenticated admin users can update photos
create policy "Admin update photos"
  on photos for update
  to authenticated
  using (true);

-- Indexes for common queries
create index photos_status_idx on photos (status);
create index photos_created_at_idx on photos (created_at desc);
create index photos_trail_section_idx on photos (trail_section);
create index photos_times_shown_idx on photos (times_shown);
