-- Date-wise availability from the owner's Google Sheet ("Room Management" tab), sent by a script
-- inside the sheet. Only numbers are stored; guest names never leave the sheet.
--
-- Snapshots are versioned by minute: a sync received during minute N is published as version N+1
-- and becomes visible to every guest at the same moment (the start of minute N+1). Between
-- minute boundaries everyone, including new and returning visitors, sees the last published one.
create table if not exists public.be_sheet_availability (
  version bigint not null,
  room_type_id text not null,
  night date not null,
  free integer not null check (free between 0 and 200),
  synced_at timestamptz not null default now(),
  primary key (version, room_type_id, night)
);
create index if not exists be_sheet_availability_version_idx on public.be_sheet_availability (version desc);

-- The sheets allowed to send availability. A script asks to connect and gets a one-time pairing
-- code; nothing it sends is accepted until a console admin approves that code. Only a SHA-256
-- hash of the sheet's token is stored.
create table if not exists public.be_sheet_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  pair_code text not null,
  label text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  requester_hash text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  last_sync_at timestamptz,
  last_sync_rows integer
);

alter table public.be_sheet_availability enable row level security;
alter table public.be_sheet_links enable row level security;
revoke all on table public.be_sheet_availability from anon, authenticated;
revoke all on table public.be_sheet_links from anon, authenticated;
grant select on table public.be_sheet_availability to authenticated;
grant select, update on table public.be_sheet_links to authenticated;
drop policy if exists be_sheet_availability_admin_read on public.be_sheet_availability;
create policy be_sheet_availability_admin_read on public.be_sheet_availability
  for select to authenticated using (public.be_is_console_admin());
drop policy if exists be_sheet_links_admin_read on public.be_sheet_links;
create policy be_sheet_links_admin_read on public.be_sheet_links for select to authenticated using (public.be_is_console_admin());
drop policy if exists be_sheet_links_admin_update on public.be_sheet_links;
create policy be_sheet_links_admin_update on public.be_sheet_links for update to authenticated
  using (public.be_is_console_admin()) with check (public.be_is_console_admin());

-- Publishes one snapshot atomically: replaces version p_version with p_rows and keeps only the
-- last few versions. Server only (service role), after the sheet's token is checked.
create or replace function public.be_sheet_publish(p_version bigint, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  delete from public.be_sheet_availability where version = p_version;
  insert into public.be_sheet_availability (version, room_type_id, night, free, synced_at)
    select p_version, r.room_type_id, r.night, r.free, now()
    from jsonb_to_recordset(p_rows) as r(room_type_id text, night date, free integer);
  get diagnostics n = row_count;
  delete from public.be_sheet_availability where version < p_version - 5;
  return n;
end;
$$;
revoke all on function public.be_sheet_publish(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.be_sheet_publish(bigint, jsonb) to service_role;
