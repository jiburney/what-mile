--v4: add content_hash for upload duplicate detection
alter table photos add column if not exists content_hash text;
create index if not exists photos_content_hash_idx on photos (content_hash);
