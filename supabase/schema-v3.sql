-- What Mile Schema Migration v3
-- Add content hash for duplicate detection
-- Run this in the Supabase SQL editor AFTER schema-v2.sql

alter table photos
  add column if not exists content_hash text;

create index if not exists photos_content_hash_idx on photos (content_hash);
