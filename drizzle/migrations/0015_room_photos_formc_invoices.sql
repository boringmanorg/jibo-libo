-- Booking engine additions (owner, 20 Nov 2026):
--   1. Room photos the super admin uploads, orders, captions and deletes from the console.
--   2. Form C tracking for foreign guests.
--   3. Business details printed on advance receipts and tax invoices.
-- Same access model as 0014: only the console admin reads or writes; guests reach these
-- through server functions.

-- 1. Room photos ---------------------------------------------------------------------------
create table if not exists public.be_room_photos (
  id uuid primary key default gen_random_uuid(),
  room_type_id text not null,
  path text not null unique,
  alt text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists be_room_photos_room_sort on public.be_room_photos (room_type_id, sort);

alter table public.be_room_photos enable row level security;
drop policy if exists be_room_photos_admin_read on public.be_room_photos;
create policy be_room_photos_admin_read on public.be_room_photos for select to authenticated using (public.be_is_console_admin());
drop policy if exists be_room_photos_admin_write on public.be_room_photos;
create policy be_room_photos_admin_write on public.be_room_photos for insert to authenticated with check (public.be_is_console_admin());
drop policy if exists be_room_photos_admin_update on public.be_room_photos;
create policy be_room_photos_admin_update on public.be_room_photos for update to authenticated using (public.be_is_console_admin()) with check (public.be_is_console_admin());
drop policy if exists be_room_photos_admin_delete on public.be_room_photos;
create policy be_room_photos_admin_delete on public.be_room_photos for delete to authenticated using (public.be_is_console_admin());

-- Public bucket: anyone can view a photo by its URL; only the console admin can add, replace or
-- remove files. Images only, 8 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-photos', 'room-photos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists room_photos_admin_insert on storage.objects;
create policy room_photos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'room-photos' and public.be_is_console_admin());
drop policy if exists room_photos_admin_update on storage.objects;
create policy room_photos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'room-photos' and public.be_is_console_admin())
  with check (bucket_id = 'room-photos' and public.be_is_console_admin());
drop policy if exists room_photos_admin_delete on storage.objects;
create policy room_photos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'room-photos' and public.be_is_console_admin());

-- 2. Form C -------------------------------------------------------------------------------
alter table public.be_guests add column if not exists form_c_number text;
alter table public.be_guests add column if not exists form_c_submitted_at timestamptz;
alter table public.be_guests add column if not exists passport_expiry date;
alter table public.be_guests add column if not exists visa_type text;
-- The admin can correct guest records; deletes stay with the booking.
drop policy if exists be_guests_admin_update on public.be_guests;
create policy be_guests_admin_update on public.be_guests for update to authenticated using (public.be_is_console_admin()) with check (public.be_is_console_admin());

-- 3. Business details for invoices -------------------------------------------------------
alter table public.be_settings add column if not exists legal_name text not null default '';
alter table public.be_settings add column if not exists gstin text not null default '';
alter table public.be_settings add column if not exists business_address text not null default '';
alter table public.be_settings add column if not exists state_code text not null default '17';
alter table public.be_settings add column if not exists sac_code text not null default '996311';

-- One tax invoice and one advance receipt per booking.
create unique index if not exists be_invoices_one_per_kind on public.be_invoices (booking_id, kind);
