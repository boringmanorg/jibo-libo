-- Date-wise availability from the owner's Google Sheet ("Room Management" tab), sent by a script
-- inside the sheet. One row per booking-engine room type and night: free beds or rooms, already
-- added up across room numbers. Only numbers are stored; guest names never leave the sheet.
create table if not exists public.be_sheet_availability (
  room_type_id text not null,
  night date not null,
  free integer not null check (free between 0 and 200),
  synced_at timestamptz not null default now(),
  primary key (room_type_id, night)
);

alter table public.be_sheet_availability enable row level security;
revoke all on table public.be_sheet_availability from anon, authenticated;
grant select on table public.be_sheet_availability to authenticated;
drop policy if exists be_sheet_availability_admin_read on public.be_sheet_availability;
create policy be_sheet_availability_admin_read on public.be_sheet_availability
  for select to authenticated using (public.be_is_console_admin());
-- Writes come only from the server (service role) after the sheet's shared secret is checked.
