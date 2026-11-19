-- XTSY booking engine tables (owner-approved requirements, 19 Nov 2026).
-- Prefixed be_ so they never collide with the legacy bookings/invoices tables.
-- Access: only the super admin (admin@xtsy.one, confirmed email) through the console;
-- the public booking flow will write through server functions with the service role.

create or replace function public.be_is_console_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'admin@xtsy.one'
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.be_is_console_admin() from public;
grant execute on function public.be_is_console_admin() to authenticated;

-- Settings: one row.
create table if not exists public.be_settings (
  id smallint primary key default 1 check (id = 1),
  engine_switched_on boolean not null default false,
  active_gateway text not null default 'zoho' check (active_gateway in ('zoho', 'razorpay')),
  hold_minutes smallint not null default 15 check (hold_minutes between 5 and 15),
  fee_table jsonb not null default '{"upi":{"bps":50},"debit_card":{"bps":90},"credit_card":{"bps":199},"international_card":{"bps":300},"net_banking":{"bps":200},"wallet":{"bps":0}}'::jsonb,
  gst_slabs jsonb not null default '{}'::jsonb,
  breakfast_gst jsonb not null default '{"kind":"5"}'::jsonb,
  policy_version text not null default '2026-11-19',
  updated_at timestamptz not null default now()
);
insert into public.be_settings (id) values (1) on conflict (id) do nothing;

-- STAAH room and rate codes per engine room type.
create table if not exists public.be_room_mapping (
  room_type_id text primary key,
  staah_room_code text not null default '',
  staah_rate_code text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.be_bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'held' check (status in ('held', 'confirmed', 'checked_in', 'settled', 'cancelled_by_guest', 'cancelled_by_xtsy', 'expired')),
  source text not null default 'website',
  check_in date not null,
  check_out date not null check (check_out > check_in),
  guest_name text not null,
  guest_email text,
  guest_phone text not null,
  nationality text,
  guests smallint not null check (guests > 0),
  taxable_paise bigint not null check (taxable_paise >= 0),
  gst_paise bigint not null check (gst_paise >= 0),
  total_paise bigint not null check (total_paise >= 0),
  advance_paise bigint not null check (advance_paise >= 0),
  balance_paise bigint not null check (balance_paise >= 0),
  date_changes_used smallint not null default 0 check (date_changes_used between 0 and 1),
  policy_version text not null,
  policy_accepted_at timestamptz,
  stargazing_ack_at timestamptz,
  channel_status text not null default 'pending' check (channel_status in ('pending', 'synced', 'failed', 'not_required')),
  channel_id text,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists be_bookings_check_in on public.be_bookings (check_in);
create index if not exists be_bookings_status on public.be_bookings (status);

create table if not exists public.be_booking_lines (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.be_bookings (id) on delete cascade,
  room_type_id text not null,
  units smallint not null check (units > 0),
  guests smallint not null check (guests > 0),
  taxable_paise bigint not null,
  gst_bps integer not null,
  gst_paise bigint not null
);
create index if not exists be_booking_lines_booking on public.be_booking_lines (booking_id);

-- Per-guest details, incl. Form C for foreign nationals. Admin-only.
create table if not exists public.be_guests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.be_bookings (id) on delete cascade,
  full_name text not null,
  gender text check (gender in ('female', 'male', 'other')),
  nationality text,
  passport_number text,
  visa_number text,
  form_c_status text not null default 'not_required' check (form_c_status in ('not_required', 'due', 'submitted'))
);

create table if not exists public.be_holds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.be_bookings (id) on delete cascade,
  room_type_id text not null,
  units smallint not null check (units > 0),
  nights date[] not null,
  expires_at timestamptz not null
);
create index if not exists be_holds_expires on public.be_holds (expires_at);

create table if not exists public.be_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.be_bookings (id) on delete cascade,
  kind text not null check (kind in ('advance', 'balance', 'refund')),
  gateway text not null,
  session_id text,
  link_id text,
  payment_id text,
  link_url text,
  method_declared text,
  method_actual text,
  amount_paise bigint not null check (amount_paise >= 0),
  gateway_charge_paise bigint not null default 0,
  status text not null default 'created' check (status in ('created', 'succeeded', 'failed', 'expired', 'refunded')),
  settled_paise bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists be_payments_gateway_payment on public.be_payments (gateway, payment_id) where payment_id is not null;
create index if not exists be_payments_booking on public.be_payments (booking_id);

-- Each verified webhook is processed once.
create table if not exists public.be_webhook_events (
  key text primary key,
  gateway text not null,
  received_at timestamptz not null default now(),
  processed boolean not null default false
);

-- Advance receipts and tax invoices, numbered without gaps per financial year and kind.
create table if not exists public.be_invoice_counters (
  fy text not null,
  kind text not null,
  last_seq integer not null default 0,
  primary key (fy, kind)
);
create table if not exists public.be_invoices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.be_bookings (id) on delete restrict,
  kind text not null check (kind in ('advance_receipt', 'tax_invoice')),
  fy text not null,
  seq integer not null,
  number text not null unique,
  taxable_paise bigint not null,
  gst_paise bigint not null,
  issued_at timestamptz not null default now(),
  unique (fy, kind, seq)
);

create or replace function public.be_next_invoice_seq(p_fy text, p_kind text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  insert into public.be_invoice_counters (fy, kind, last_seq) values (p_fy, p_kind, 1)
  on conflict (fy, kind) do update set last_seq = public.be_invoice_counters.last_seq + 1
  returning last_seq into n;
  return n;
end;
$$;
revoke all on function public.be_next_invoice_seq(text, text) from public;
-- Only the server issues invoice numbers.
grant execute on function public.be_next_invoice_seq(text, text) to service_role;

create table if not exists public.be_channel_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.be_bookings (id) on delete set null,
  direction text not null check (direction in ('out', 'in', 'test')),
  message_type text not null,
  status text not null check (status in ('ok', 'failed', 'pending')),
  attempts smallint not null default 1,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists be_channel_log_created on public.be_channel_log (created_at desc);

create table if not exists public.be_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_email text default (auth.jwt() ->> 'email'),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists be_audit_log_created on public.be_audit_log (created_at desc);

-- Row-level security: every table is closed except to the console admin.
do $$
declare t text;
begin
  foreach t in array array['be_settings','be_room_mapping','be_bookings','be_booking_lines','be_guests','be_holds','be_payments','be_webhook_events','be_invoice_counters','be_invoices','be_channel_log','be_audit_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.be_is_console_admin())', t || '_admin_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.be_is_console_admin())', t || '_admin_write', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.be_is_console_admin()) with check (public.be_is_console_admin())', t || '_admin_update', t);
  end loop;
end $$;

-- The audit log is append-only, even for the admin.
drop policy if exists be_audit_log_admin_update on public.be_audit_log;
