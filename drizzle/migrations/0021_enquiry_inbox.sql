create table if not exists public.be_enquiries (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  kind text not null check (kind in ('stay', 'camp')),
  guest_name text not null,
  guest_phone text not null,
  check_in date not null,
  check_out date not null,
  guests integer not null check (guests between 1 and 60),
  summary text not null,
  estimate_rupees integer not null check (estimate_rupees >= 0),
  status text not null default 'new' check (status in ('new', 'contacted', 'confirmed', 'lost')),
  desk_note text,
  visitor_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists be_enquiries_created_idx on public.be_enquiries (created_at desc);
create index if not exists be_enquiries_visitor_idx on public.be_enquiries (visitor_hash, created_at desc);
revoke all on table public.be_enquiries from anon, authenticated;
grant select, update on table public.be_enquiries to authenticated;
grant all on table public.be_enquiries to service_role;
alter table public.be_enquiries enable row level security;
drop policy if exists be_enquiries_admin_read on public.be_enquiries;
create policy be_enquiries_admin_read on public.be_enquiries for select to authenticated using (public.be_is_console_admin());
drop policy if exists be_enquiries_admin_update on public.be_enquiries;
create policy be_enquiries_admin_update on public.be_enquiries for update to authenticated
  using (public.be_is_console_admin()) with check (public.be_is_console_admin());