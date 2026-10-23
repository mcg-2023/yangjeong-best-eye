create table if not exists public.posts (
  id text primary key,
  data jsonb not null,
  status text not null default 'draft' check (status in ('draft','medical_review','published','archived')),
  updated_at timestamptz not null,
  constraint posts_matching_id check (data->>'id' = id),
  constraint posts_matching_status check (data->>'status' = status)
);
create index if not exists posts_status_updated_idx on public.posts (status, updated_at);
alter table public.posts enable row level security;
revoke all on public.posts from anon, authenticated;
grant select, insert, update, delete on public.posts to service_role;
-- The server authenticates administrators and serves only published posts publicly.
-- No browser role receives direct read/write access to drafts or posts.
