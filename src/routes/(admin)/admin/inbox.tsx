import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { MessageCircle, Phone, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { listInbox, updateEnquiry } from '@/admin/consoleHome.functions';
import { PageHead, Panel, STATUS_LABEL, STATUS_STYLE, ago, dayMonth, inrWhole } from '@/admin/components/ConsoleBits';

export const Route = createFileRoute('/(admin)/admin/inbox')({ component: InboxPage });

type Status = 'new' | 'contacted' | 'confirmed' | 'lost';
const TABS: (Status | 'all')[] = ['new', 'contacted', 'confirmed', 'lost', 'all'];

function InboxPage() {
  const [tab, setTab] = useState<Status | 'all'>('new');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const fetchInbox = useServerFn(listInbox);
  const filters = { ...(tab !== 'all' ? { status: tab } : {}), ...(search ? { search } : {}) };
  const { data, error } = useQuery({ queryKey: ['console', 'inbox', filters], queryFn: () => fetchInbox({ data: filters }), refetchInterval: 60_000 });
  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div>
      <PageHead title="Inbox" sub="Every enquiry sent from /book and the Shnonpedeng camp page, newest first." />
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
