-- ZimmerStack channel manager (partner model: one XTSY company key, many properties).
-- Each XTSY property has its own on/off switch; nothing is sent for a property while it is off.
-- Writes happen only from the server (service role) after an admin's action, a sheet edit or a
-- verified ZimmerStack webhook. The signed-in console admin may read everything here.

create table if not exists public.be_channel_properties (
  id text primary key,                                   -- XTSY property id, e.g. XTSY-SHL-HOSTEL
  name text not null,
  enabled boolean not null default false,                -- the admin's switch for this property
  zs_property_id bigint,                                 -- ZimmerStack's hotel id
  zs_mode text check (zs_mode in ('test', 'live')),      -- which key type the id belongs to
  zs_live boolean not null default false,                -- XTSY is the hotel's source of truth
  event_place bigint not null default 0,                 -- last event-log sequence applied
  last_event_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (zs_mode, zs_property_id)
);

insert into public.be_channel_properties (id, name) values
  ('XTSY-SHL-HOSTEL', 'XTSY Travellers Hostel'),
  ('XTSY-SHN-CAMP', 'Shnonpedeng Riverside Camping')
on conflict (id) do nothing;

-- XTSY room type -> ZimmerStack room type and its room-only rate plan, per key type.
create table if not exists public.be_channel_room_map (
  property_id text not null references public.be_channel_properties(id) on delete cascade,
  room_type_id text not null,
  zs_mode text not null check (zs_mode in ('test', 'live')),
  zs_room_type_id bigint not null,
  zs_rate_plan_id bigint,
  updated_at timestamptz not null default now(),
  primary key (property_id, room_type_id, zs_mode)
);

-- The last room count sent for each night, so only changed nights are ever sent again.
create table if not exists public.be_channel_sent_counts (
  property_id text not null references public.be_channel_properties(id) on delete cascade,
  room_type_id text not null,
  night date not null,
  available integer not null check (available between 0 and 500),
  sent_at timestamptz not null default now(),
  primary key (property_id, room_type_id, night)
);

-- OTA bookings delivered by ZimmerStack. They hold their rooms on /book until the owner edits
-- that night's count in the Google Sheet (sheet_at_arrival keeps the counts seen on arrival).
create table if not exists public.be_ota_bookings (
  zs_booking_id bigint not null,
  zs_mode text not null check (zs_mode in ('test', 'live')),
  property_id text not null references public.be_channel_properties(id) on delete cascade,
  version integer not null default 1,
  status text not null check (status in ('CONFIRMED', 'CANCELLED')),
  ota_name text,
  ota_code text,
  check_in date not null,
  check_out date not null,
  guest_name text,
  guest_phone text,
  guest_email text,
  contact_withheld text,
  adults integer not null default 0,
  children integer not null default 0,
  total numeric(12, 2),
  currency text,
  rooms jsonb not null default '[]'::jsonb,              -- [{ roomTypeId, units }]
  sheet_at_arrival jsonb not null default '{}'::jsonb,   -- { roomTypeId: { night: free } }
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (zs_mode, zs_booking_id),
  check (check_out > check_in)
);
create index if not exists be_ota_bookings_check_out on public.be_ota_bookings (check_out);

alter table public.be_channel_properties enable row level security;
alter table public.be_channel_room_map enable row level security;
alter table public.be_channel_sent_counts enable row level security;
alter table public.be_ota_bookings enable row level security;

revoke all on table public.be_channel_properties from anon, authenticated;
revoke all on table public.be_channel_room_map from anon, authenticated;
revoke all on table public.be_channel_sent_counts from anon, authenticated;
revoke all on table public.be_ota_bookings from anon, authenticated;
grant select on table public.be_channel_properties to authenticated;
grant select on table public.be_channel_room_map to authenticated;
grant select on table public.be_channel_sent_counts to authenticated;
grant select on table public.be_ota_bookings to authenticated;

drop policy if exists be_channel_properties_admin_read on public.be_channel_properties;
create policy be_channel_properties_admin_read on public.be_channel_properties for select to authenticated using (public.be_is_console_admin());
drop policy if exists be_channel_room_map_admin_read on public.be_channel_room_map;
create policy be_channel_room_map_admin_read on public.be_channel_room_map for select to authenticated using (public.be_is_console_admin());
drop policy if exists be_channel_sent_counts_admin_read on public.be_channel_sent_counts;
create policy be_channel_sent_counts_admin_read on public.be_channel_sent_counts for select to authenticated using (public.be_is_console_admin());
drop policy if exists be_ota_bookings_admin_read on public.be_ota_bookings;
create policy be_ota_bookings_admin_read on public.be_ota_bookings for select to authenticated using (public.be_is_console_admin());

-- An OTA booking arriving, changing or cancelling rings the same data-free signal as a sheet sync,
-- so every open /book page refetches its counts at once.
create or replace function public.be_ota_bookings_doorbell()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send('{}'::jsonb, 'synced', 'sheet-availability', false);
  return null;
end $$;
revoke execute on function public.be_ota_bookings_doorbell() from public, anon, authenticated;
drop trigger if exists be_ota_bookings_doorbell on public.be_ota_bookings;
create trigger be_ota_bookings_doorbell after insert or update or delete on public.be_ota_bookings
  for each statement execute function public.be_ota_bookings_doorbell();
