-- Trim scheduled jobs that spend credits for no benefit.
--
-- 1. seo-position-cron: daily -> weekly (Mondays 02:40 UTC / 08:10 IST).
--    Each run pulls up to 250 Semrush rows; weekly-rank-tracker already takes a weekly snapshot
--    into the same seo_position_snapshots table, so daily runs mostly duplicated that cost.
-- 2. analytics-loader-daily-summary: removed. It posts to an old Supabase project
--    (oidnydyyjyjfnyadhyzn), not this one, so it does nothing useful.
--
-- Jobs are matched by what they call, not only by name, because the seo-position-cron job was
-- created outside the migrations and its job name is not recorded in this repo. Safe to re-run.

do $$
declare
  job record;
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron is not installed; nothing to change';
    return;
  end if;

  for job in
    select jobid, jobname, schedule from cron.job
    where command ilike '%seo-position-cron%'
  loop
    perform cron.alter_job(job.jobid, schedule := '40 2 * * 1');
    raise notice 'seo-position-cron job % (%) moved from "%" to weekly', job.jobid, job.jobname, job.schedule;
  end loop;

  for job in
    select jobid, jobname from cron.job
    where jobname = 'analytics-loader-daily-summary'
       or command ilike '%oidnydyyjyjfnyadhyzn%'
  loop
    perform cron.unschedule(job.jobid);
    raise notice 'removed job % (%)', job.jobid, job.jobname;
  end loop;
end $$;
