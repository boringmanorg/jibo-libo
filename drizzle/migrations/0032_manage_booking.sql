-- Guest self-service ("Manage my booking") and the OTA duplicate guard.
-- Guests never touch these tables: the website's server reads and writes them with the service
-- role after checking the booking reference and phone number. The console admin may read them.

-- Every lookup attempt on /book/manage, so guessing references or phone numbers is throttled
-- (per visitor and per booking). Only a salted daily hash of the visitor's address is kept.
create table if not exists public.be_guest_lookups (
  id bigint generated always as identity primary key,
  visitor_hash text not null,
  reference text not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists be_guest_lookups_visitor on public.be_guest_lookups (visitor_hash, created_at);
create index if not exists be_guest_lookups_reference on public.be_guest_lookups (reference, created_at);

-- A guest's request to use their one date change. The desk applies it from the console (the
-- existing date-change action checks the policy and the price again) or declines it.
create table if not exists public.be_change_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.be_bookings (id) on delete cascade,
  check_in date not null,
  check_out date not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'applied', 'declined')),
  decided_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (check_out > check_in)
);
-- At most one open request per booking.
create unique index if not exists be_change_requests_one_open on public.be_change_requests (booking_id) where status = 'pending';

-- The same OTA reservation delivered again under a new ZimmerStack booking id: kept for the record,
-- flagged in the console, and (when it is the same stay) not holding rooms a second time.
alter table public.be_ota_bookings add column if not exists duplicate_of bigint;

alter table public.be_guest_lookups enable row level security;
alter table public.be_change_requests enable row level security;
revoke all on table public.be_guest_lookups from anon, authenticated;
revoke all on table public.be_change_requests from anon, authenticated;
grant select on table public.be_change_requests to authenticated;
drop policy if exists be_change_requests_admin_read on public.be_change_requests;
create policy be_change_requests_admin_read on public.be_change_requests for select to authenticated using (public.be_is_console_admin());
-- The console admin applies or declines a request (status and reason only).
grant update (status, decided_reason, decided_at) on table public.be_change_requests to authenticated;
drop policy if exists be_change_requests_admin_decide on public.be_change_requests;
create policy be_change_requests_admin_decide on public.be_change_requests for update to authenticated
  using (public.be_is_console_admin()) with check (public.be_is_console_admin());
