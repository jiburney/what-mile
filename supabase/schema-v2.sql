-- What Mile Schema Migration v2
-- Run this in the Supabase SQL editor AFTER schema.sql for existing databases.
-- This is an additive migration — it does not drop or modify existing columns.

-- Add new columns for photo pipeline and analytics
alter table photos
  add column if not exists taken_at      timestamptz,      -- EXIF timestamp, powers seasonal browsing
  add column if not exists trail_section text,             -- State or named section (e.g. "Georgia"), powers geographic filtering
  add column if not exists times_shown   integer not null default 0,    -- Game appearance count, powers difficulty balancing
  add column if not exists avg_score     double precision, -- Running average player score, powers difficulty analytics
  add column if not exists is_private    boolean not null default false; -- Whether photo is in private bucket (pipeline) vs public bucket (approved)

-- Indexes for geographic filtering and analytics queries
create index if not exists photos_trail_section_idx on photos (trail_section);
create index if not exists photos_times_shown_idx on photos (times_shown);

-- RLS policies for authenticated admin users
-- These allow the admin UI (once logged in) to read/write all photos, including pending/review/skip
-- which the public anon key can never see.

create policy "Admin read all photos"
  on photos for select
  to authenticated
  using (true);

create policy "Admin insert photos"
  on photos for insert
  to authenticated
  with check (true);

create policy "Admin update photos"
  on photos for update
  to authenticated
  using (true);
