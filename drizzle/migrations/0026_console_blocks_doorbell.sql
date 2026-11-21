create or replace function public.be_console_blocks_doorbell()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send('{}'::jsonb, 'synced', 'sheet-availability', false);
  return null;
end $$;
revoke execute on function public.be_console_blocks_doorbell() from public, anon, authenticated;
drop trigger if exists be_console_blocks_doorbell on public.console_inventory_overrides;
create trigger be_console_blocks_doorbell after insert or update or delete on public.console_inventory_overrides
  for each statement execute function public.be_console_blocks_doorbell();