-- Additive, safe to run again. Existing posts and image records are untouched.
create table if not exists public.pm_analytics_sites (id text primary key, data jsonb not null);
create table if not exists public.pm_analytics_hits (
 id text primary key, site_id text not null, visitor_id text not null,
 session_id text not null, created_at timestamptz not null, data jsonb not null
);
create index if not exists pm_hits_site_time on public.pm_analytics_hits(site_id,created_at);
create index if not exists pm_hits_time on public.pm_analytics_hits(created_at);
create index if not exists pm_hits_session on public.pm_analytics_hits(session_id,site_id);
create table if not exists public.pm_analytics_visitors (
 site_id text not null, visitor_id text not null, first_seen_at timestamptz not null,
 primary key(site_id,visitor_id)
);
alter table public.pm_analytics_sites enable row level security;
alter table public.pm_analytics_hits enable row level security;
alter table public.pm_analytics_visitors enable row level security;
revoke all on public.pm_analytics_sites, public.pm_analytics_hits, public.pm_analytics_visitors from anon, authenticated;
grant select, insert, update, delete on public.pm_analytics_sites, public.pm_analytics_hits, public.pm_analytics_visitors to service_role;

-- One transaction/request per beacon. End checkpoints update a single row with
-- the greatest observed duration, even if Vercel instances finish out of order.
create or replace function public.pm_analytics_ingest(hit jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
 insert into public.pm_analytics_hits as stored(id,site_id,visitor_id,session_id,created_at,data)
 values(hit->>'id',hit->>'siteId',hit->>'visitorId',hit->>'sessionId',(hit->>'createdAt')::timestamptz,hit)
 on conflict(id) do update
 set data=jsonb_set(stored.data,'{duration}',excluded.data->'duration')
 where excluded.data->>'kind'='end'
   and (excluded.data->>'duration')::integer > (stored.data->>'duration')::integer;
 insert into public.pm_analytics_visitors(site_id,visitor_id,first_seen_at)
 values(hit->>'siteId',hit->>'visitorId',(hit->>'createdAt')::timestamptz)
 on conflict(site_id,visitor_id) do nothing;
end;
$$;
revoke all on function public.pm_analytics_ingest(jsonb) from public, anon, authenticated;
grant execute on function public.pm_analytics_ingest(jsonb) to service_role;
