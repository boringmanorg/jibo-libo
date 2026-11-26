-- Google Sheet write-back: OTA bookings (from ZimmerStack) and website bookings are written into the
-- owner's "Room Management" tab the way the owner writes them by hand ("Priyanka Sharma 2B MMT",
-- "Rahul 2G XTSY"); the owner keeps typing only offline bookings.
--
-- The website never touches the sheet itself. It queues a request here; the script inside the sheet
-- (scripts/google-sheet/availability-sync.gs) collects the open requests with its own token, picks
-- the rooms, lowers the counts, adds the notes, then sends the new counts back together with what it
-- wrote. Only then does the website stop counting that booking separately, so a room is never
-- counted twice as free.
--
-- Nothing is queued until the paired sheet runs the write-back script (be_sheet_links.writes_since).

alter table public.be_sheet_links add column if not exists writes_since timestamptz;

create table if not exists public.be_sheet_writes (
  id bigint generated always as identity primary key,
  source text not null check (source in ('ota', 'website')),
  source_ref text not null,                              -- 'live:123' (ZimmerStack mode:id) or the website reference
  kind text not null check (kind in ('book', 'cancel')),
  cancels bigint references public.be_sheet_writes(id),  -- the book request a cancel undoes
  tag text not null,                                     -- MMT, BDC, AGODA, HW, XTSY ...
  guest_name text not null,
  check_in date not null,
  check_out date not null,
  rooms jsonb not null default '[]'::jsonb,              -- [{ roomTypeId, units, guests }]
  status text not null default 'pending' check (status in ('pending', 'applied', 'superseded')),
  placed jsonb,                                          -- what the sheet did: [{ roomNo, night, units, note }]
  problem text,                                          -- e.g. a month missing from the sheet, or OVERBOOKED
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  check (check_out > check_in),
  check ((kind = 'cancel') = (cancels is not null))
);
create index if not exists be_sheet_writes_pending on public.be_sheet_writes (id) where status = 'pending';
create index if not exists be_sheet_writes_source on public.be_sheet_writes (source, source_ref);

-- Where each booking stands: null = not written by the website (older booking or write-back off),
-- 'queued' = waiting for the sheet, 'applied' = the sheet's counts include it.
alter table public.be_ota_bookings add column if not exists sheet_write text check (sheet_write in ('queued', 'applied'));
alter table public.be_bookings add column if not exists sheet_write text check (sheet_write in ('queued', 'applied'));

alter table public.be_sheet_writes enable row level security;
revoke all on table public.be_sheet_writes from anon, authenticated;
grant select on table public.be_sheet_writes to authenticated;
drop policy if exists be_sheet_writes_admin_read on public.be_sheet_writes;
create policy be_sheet_writes_admin_read on public.be_sheet_writes for select to authenticated using (public.be_is_console_admin());

-- A request being written (or failing) rings the same data-free signal as a sheet sync, so every
-- open /book page and console screen refetches at once.
create or replace function public.be_sheet_writes_doorbell()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send('{}'::jsonb, 'synced', 'sheet-availability', false);
  return null;
end $$;
revoke execute on function public.be_sheet_writes_doorbell() from public, anon, authenticated;
drop trigger if exists be_sheet_writes_doorbell on public.be_sheet_writes;
create trigger be_sheet_writes_doorbell after insert or update on public.be_sheet_writes
  for each statement execute function public.be_sheet_writes_doorbell();
