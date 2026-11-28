import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { MessageCircle, Phone, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConsoleScope } from '@/admin/consoleScope';
import { buildRouteHead } from '@/lib/seo-head';
import { listInbox, updateEnquiry } from '@/admin/consoleHome.functions';
import { listOtaBookings, listSheetWriteIssues } from '@/admin/channel.functions';
import { applyDateChangeRequest, declineDateChangeRequest, listDateChangeRequests } from '@/admin/bookingConsole.functions';
import { PageHead, Panel, STATUS_LABEL, STATUS_STYLE, ago, dayMonth, inrWhole } from '@/admin/components/ConsoleBits';

export const Route = createFileRoute('/(admin)/admin/inbox')({ head: () => buildRouteHead({ path: '/admin/inbox', title: 'Enquiries — XTSY Console', description: 'Review permitted XTSY booking enquiries and date-change requests.', noIndex: true }), component: InboxPage });

type Status = 'new' | 'contacted' | 'confirmed' | 'lost';
const TABS: (Status | 'all')[] = ['new', 'contacted', 'confirmed', 'lost', 'all'];

function InboxPage() {
  const scope = useConsoleScope();
  const [tab, setTab] = useState<Status | 'all'>('new');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const fetchInbox = useServerFn(listInbox);
  const filters = { ...(tab !== 'all' ? { status: tab } : {}), ...(search ? { search } : {}) };
  const { data, error } = useQuery({ queryKey: ['console', 'inbox', filters], queryFn: () => fetchInbox({ data: filters }), refetchInterval: 60_000 });
  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div>
      <PageHead title="Inbox" sub={scope === 'super' ? 'Every enquiry sent from /book and the Shnonpedeng camp page, newest first.' : 'Hostel booking enquiries, newest first.'} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-xt-line bg-white p-1" role="tablist" aria-label="Enquiry status">
          {TABS.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={tab === s} onClick={() => setTab(s)}
              className={cn('min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold', tab === s ? 'bg-xt-ink text-xt-sand' : 'text-xt-mute hover:text-xt-ink')}>
              {s === 'all' ? 'All' : STATUS_LABEL[s]}{data && <span className="ml-1.5 opacity-70">{s === 'all' ? total : data.counts[s] ?? 0}</span>}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }} className="flex w-full min-w-0 items-center gap-2 rounded-full border border-xt-line bg-white pl-4 sm:w-auto">
          <Search className="h-4 w-4 shrink-0 text-xt-mute" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone or XTSY-…" aria-label="Search enquiries" className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none" />
          <button type="submit" className="min-h-11 rounded-full bg-xt-ink px-4 text-sm font-semibold text-xt-sand">Search</button>
        </form>
      </div>

      {error && <p className="text-destructive">Could not load the inbox. {(error as Error).message}</p>}
      {!data ? <p className="text-muted-foreground">Loading…</p> : !data.ready ? (
        <Panel><p className="text-[15px] text-xt-mute">The inbox starts once this update’s database change has run. After that, every enquiry a guest sends from /book or the camp page appears here before the WhatsApp chat opens.</p></Panel>
      ) : data.enquiries.length === 0 ? (
        <Panel><p className="text-[15px] text-xt-mute">{search ? `Nothing matches “${search}”.` : tab === 'new' ? 'No new enquiries. You’re all caught up.' : 'Nothing here yet.'}</p></Panel>
      ) : (
        <ul className="space-y-3">{data.enquiries.map((e: any) => <EnquiryCard key={e.id} e={e} />)}</ul>
      )}

      <DateChangeRequests />
      {scope === 'super' && <SheetWriteIssues />}
      <OtaBookings />

      {data && data.onlineBookings.length > 0 && (
        <Panel title="Paid online bookings" className="mt-8" action={<Link to="/admin/bookings" className="text-sm font-semibold text-xt-crimson">Manage</Link>}>
          <ul className="divide-y divide-xt-line">
            {data.onlineBookings.map((b: any) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[15px]">
                <span><span className="font-semibold">{b.guest_name}</span> · {b.reference} · {dayMonth(b.check_in)} → {dayMonth(b.check_out)}</span>
                <span className="text-xt-mute">{inrWhole(b.total_paise / 100)} · {b.status.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

const PROPERTY_NAME: Record<string, string> = { 'XTSY-SHL-HOSTEL': 'Hostel', 'XTSY-SHN-CAMP': 'Shnonpedeng camp' };

/** Guests' date change requests from "Manage my booking": apply (policy and price checked again) or decline. */
function DateChangeRequests() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listDateChangeRequests);
  const apply = useServerFn(applyDateChangeRequest);
  const decline = useServerFn(declineDateChangeRequest);
  const [reason, setReason] = useState<Record<string, string>>({});
  const { data } = useQuery({ queryKey: ['console', 'date-change-requests'], queryFn: () => fetchList(), refetchInterval: 60_000 });
  const done = (msg: string) => { toast.success(msg); void qc.invalidateQueries({ queryKey: ['console'] }); };
  const applyM = useMutation({ mutationFn: (id: string) => apply({ data: { id } }), onSuccess: (r: any) => done(r.extra > 0 ? `Dates changed; ${inrWhole(r.extra / 100)} added to the balance` : 'Dates changed'), onError: (e) => toast.error(e.message) });
  const declineM = useMutation({ mutationFn: (v: { id: string; reason: string }) => decline({ data: v }), onSuccess: () => done('Request declined'), onError: (e) => toast.error(e.message) });
  const open = (data?.rows ?? []).filter((r: any) => r.status === 'pending');
  if (!open.length) return null;
  return (
    <Panel title="Date change requests" className="mt-8">
      <p className="mb-3 text-sm text-xt-mute">Sent by guests from “Manage my booking”. Applying uses the same date change as the booking page: the policy and the price are checked again, and any higher price is added to the balance.</p>
      <ul className="divide-y divide-xt-line">
        {open.map((r: any) => (
          <li key={r.id} className="py-4 text-[15px]">
            <p><span className="font-semibold">{r.be_bookings?.guest_name}</span> · {r.be_bookings?.reference}</p>
            <p className="text-sm text-xt-mute">Now {dayMonth(r.be_bookings?.check_in)} → {dayMonth(r.be_bookings?.check_out)} · asks for <span className="font-semibold text-xt-ink">{dayMonth(r.check_in)} → {dayMonth(r.check_out)}</span> · {ago(r.created_at)}</p>
            {r.note && <p className="mt-1 text-sm text-xt-ink">“{r.note}”</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" disabled={applyM.isPending} onClick={() => applyM.mutate(r.id)} className="min-h-10 rounded-full bg-xt-ink px-4 text-sm font-bold text-xt-sand disabled:opacity-40">Apply new dates</button>
              <input value={reason[r.id] ?? ''} onChange={(e) => setReason((v) => ({ ...v, [r.id]: e.target.value }))} placeholder="Reason the guest will see"
                className="min-h-10 min-w-0 flex-1 rounded-full border border-xt-line px-4 text-sm" aria-label="Reason for declining" />
              <button type="button" disabled={declineM.isPending} onClick={() => declineM.mutate({ id: r.id, reason: reason[r.id] ?? '' })} className="min-h-10 rounded-full border border-xt-line px-4 text-sm font-semibold disabled:opacity-40">Decline</button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Bookings the Google Sheet's script could not write (or has not collected): the owner fixes these by hand. */
function SheetWriteIssues() {
  const fetchIssues = useServerFn(listSheetWriteIssues);
  const { data } = useQuery({ queryKey: ['console', 'sheet-write-issues'], queryFn: () => fetchIssues(), refetchInterval: 60_000 });
  if (!data || data.rows.length === 0) return null;
  return (
    <Panel title="Google Sheet needs you" className="mt-8">
      <p className="mb-3 text-sm text-xt-mute">These bookings could not be written into Room Management as usual. Their rooms stay held on /book until it is sorted.</p>
      <ul className="divide-y divide-xt-line">
        {data.rows.map((w) => (
          <li key={w.id} className="py-3 text-[15px]">
            <span className="font-semibold">{w.guest_name}</span> · {w.tag} · {dayMonth(w.check_in)} → {dayMonth(w.check_out)}{w.kind === 'cancel' ? ' · cancellation' : ''}
            <span className="block text-sm text-xt-mute">
              {w.problem ?? `Queued ${ago(w.created_at)} and not collected by the sheet yet. Open the sheet and choose XTSY → Sync with xtsy.one now.`}
              {w.status === 'applied' && w.problem ? ' Written, but check these nights in the sheet.' : ''}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const SHEET_STATE: Record<string, string> = { applied: 'In the sheet', queued: 'Writing to the sheet' };

/** OTA bookings delivered by ZimmerStack (upcoming). Their rooms are held on /book until the sheet has them. */
function OtaBookings() {
  const fetchOta = useServerFn(listOtaBookings);
  const fetchIssues = useServerFn(listSheetWriteIssues);
  const { data } = useQuery({ queryKey: ['console', 'ota-bookings'], queryFn: () => fetchOta(), refetchInterval: 60_000 });
  const { data: gate } = useQuery({ queryKey: ['console', 'sheet-write-issues'], queryFn: () => fetchIssues(), refetchInterval: 60_000 });
  if (!data?.ready || data.rows.length === 0) return null;
  const writing = gate?.enabled || data.rows.some((b) => b.sheet_write);
  return (
    <Panel title="OTA bookings (ZimmerStack)" className="mt-8">
      <p className="mb-3 text-sm text-xt-mute">{writing
        ? 'These rooms are held on /book at once and written into your Google Sheet within a minute (“Name 2B MMT”). No need to type them.'
        : 'These rooms are held on /book at once. Update the nights in your Google Sheet as usual; the hold drops when you do.'}
        {!writing && gate && gate.missing.length > 0 && <span className="mt-1 block">Automatic writing into the sheet starts once all of these are live: {gate.missing.join('; ')}.</span>}</p>
      <ul className="divide-y divide-xt-line">
        {data.rows.map((b) => (
          <li key={`${b.zs_mode}-${b.zs_booking_id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[15px]">
            <span className="min-w-0">
              <span className="font-semibold">{b.guest_name ?? 'Guest'}</span> · {b.ota_name ?? 'OTA'}{b.ota_code ? ` ${b.ota_code}` : ''} · {dayMonth(b.check_in)} → {dayMonth(b.check_out)}
              <span className="block text-sm text-xt-mute">{PROPERTY_NAME[b.property_id] ?? b.property_id} · {b.rooms.map((r) => `${r.units} × ${r.roomTypeId.replace(/-/g, ' ')}`).join(', ') || 'room not linked'}{b.guest_phone ? ` · ${b.guest_phone}` : ''}{b.zs_mode === 'test' ? ' · sandbox' : ''}</span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              {b.duplicate_of != null && <span className="rounded-full bg-xt-blush px-2.5 py-0.5 text-xs font-bold text-xt-crimson-dark" title={`The OTA sent reservation ${b.ota_code ?? ''} again; it was first received as ZimmerStack #${b.duplicate_of}. Same nights and rooms: held once. Different: both held; check the extranet.`}>Sent twice · first #{b.duplicate_of}</span>}
              {b.status !== 'CANCELLED' && b.sheet_write && <span className="rounded-full bg-xt-cream px-2.5 py-0.5 text-xs font-bold text-xt-ink">{SHEET_STATE[b.sheet_write]}</span>}
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', b.status === 'CANCELLED' ? 'bg-xt-cream text-xt-mute' : 'bg-xt-leaf/10 text-xt-pine')}>{b.status === 'CANCELLED' ? 'Cancelled' : 'Confirmed'}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function EnquiryCard({ e }: { e: any }) {
  const qc = useQueryClient();
  const update = useServerFn(updateEnquiry);
  const [note, setNote] = useState<string>(e.desk_note ?? '');
  const [open, setOpen] = useState(false);
  const m = useMutation({
    mutationFn: (patch: { status?: Status; note?: string }) => update({ data: { id: e.id, ...patch } }),
    onSuccess: (_r, v) => { toast.success(v.status ? `Marked ${STATUS_LABEL[v.status].toLowerCase()}` : 'Note saved'); void qc.invalidateQueries({ queryKey: ['console'] }); },
    onError: (err) => toast.error(err.message),
  });
  const digits = String(e.guest_phone).replace(/\D/g, '');
  const wa = `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(`Hi ${e.guest_name.split(' ')[0]}, this is the XTSY desk about your enquiry ${e.reference}.`)}`;
  return (
    <li className="rounded-[24px] border border-xt-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-extrabold text-xt-ink">{e.guest_name}</span>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', STATUS_STYLE[e.status])}>{STATUS_LABEL[e.status]}</span>
            <span className="rounded-full bg-xt-sand px-2.5 py-0.5 text-xs font-semibold text-xt-mute">{e.kind === 'camp' ? 'Shnonpedeng camp' : 'Hostel'}</span>
          </p>
          <p className="mt-1 text-[15px] text-xt-ink">{dayMonth(e.check_in)} → {dayMonth(e.check_out)} · {e.guests} guest{e.guests === 1 ? '' : 's'} · <span className="font-semibold">{inrWhole(e.estimate_rupees)}</span></p>
          <p className="text-sm text-xt-mute">{e.reference} · {e.guest_phone} · {ago(e.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-xt-leaf px-4 text-sm font-bold text-white"><MessageCircle className="h-4 w-4" aria-hidden />WhatsApp</a>
          <a href={`tel:${digits.length === 10 ? `+91${digits}` : `+${digits}`}`} aria-label={`Call ${e.guest_name}`} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-xt-line"><Phone className="h-4 w-4" /></a>
        </div>
      </div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-3 text-sm font-semibold text-xt-crimson">{open ? 'Hide details' : 'Show details'}</button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="whitespace-pre-line rounded-2xl bg-xt-sand p-4 text-sm text-xt-ink">{String(e.summary).split(' | ').join('\n')}</p>
          <label className="block text-sm font-semibold text-xt-ink">Desk note
            <textarea value={note} onChange={(ev) => setNote(ev.target.value)} className="mt-1 h-20 w-full rounded-2xl border border-xt-line p-3 text-base font-normal" />
          </label>
          <button type="button" disabled={m.isPending || note === (e.desk_note ?? '')} onClick={() => m.mutate({ note })} className="min-h-11 rounded-full border border-xt-ink px-4 text-sm font-bold disabled:opacity-40">Save note</button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-xt-line pt-4">
        {(['contacted', 'confirmed', 'lost', 'new'] as Status[]).filter((s) => s !== e.status).map((s) => (
          <button key={s} type="button" disabled={m.isPending} onClick={() => m.mutate({ status: s })}
            className="min-h-10 rounded-full border border-xt-line px-4 text-sm font-semibold text-xt-ink hover:border-xt-ink disabled:opacity-40">
            {s === 'new' ? 'Mark as new' : `Mark ${STATUS_LABEL[s].toLowerCase()}`}
          </button>
        ))}
      </div>
    </li>
  );
}
