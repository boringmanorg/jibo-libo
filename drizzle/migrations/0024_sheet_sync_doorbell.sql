create or replace function public.be_sheet_sync_doorbell()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.last_sync_at is distinct from old.last_sync_at then
    perform realtime.send('{}'::jsonb, 'synced', 'sheet-availability', false);
  end if;
  return new;
end $$;
revoke execute on function public.be_sheet_sync_doorbell() from public, anon, authenticated;
drop trigger if exists be_sheet_sync_doorbell on public.be_sheet_links;
create trigger be_sheet_sync_doorbell after update of last_sync_at on public.be_sheet_links
  for each row execute function public.be_sheet_sync_doorbell();