import { createFileRoute } from '@tanstack/react-router';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Printer, QrCode, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHead, Panel } from '@/admin/components/ConsoleBits';
import { getCheckInDocumentFn, listCheckInsFn } from '@/checkin/checkIn.functions';
import { AllocationPanel } from '@/admin/components/AllocationPanel';
import { CHECK_IN_PROPERTIES, roomPreferences, type CheckInPropertyId } from '@/checkin/checkInModel';
import { useConsoleAccess, useConsoleProperty, useConsoleScope } from '@/admin/consoleScope';
import { checkInUrl } from '@/admin/consoleProperties';
import { deleteCheckIn } from '@/admin/console.functions';
import { CheckInQrSign } from '@/admin/components/CheckInQrSign';
import { Button } from '@/components/ui/button';
import { buildRouteHead } from '@/lib/seo-head';

export const Route = createFileRoute('/(admin)/admin/check-in')({
  head: () => buildRouteHead({
    path: '/admin/check-in', noIndex: true,
    title: 'Self Check-in Desk | XTSY Console',
    description: 'Private front-desk self-check-in records and identity documents.',
  }),
  component: CheckInDesk,
});

type CheckInRow = {
  id: string; propertyId: CheckInPropertyId; bookingReference: string; guestName: string; checkInDate: string; checkInTime: string;
  city: string; state: string; country: string; phone: string; email: string; totalGuests: number; purpose: string;
  isInternational: boolean; roomTypeId: string; status: string; createdAt: string;
  checkOutDate: string; allocatedRoomTypeId: string; allocatedUnits: string[]; allocationOverrideId: string; documents: { front: boolean; back: boolean; visa: boolean };
};

const propertyName = (id: string) => CHECK_IN_PROPERTIES.find((p) => p.id === id)?.name ?? id;
const roomName = (propertyId: CheckInPropertyId, id: string) => roomPreferences(propertyId).find((r) => r.id === id)?.name ?? id;

function CheckInDesk() {
  const list = useServerFn(listCheckInsFn);
  const documentLink = useServerFn(getCheckInDocumentFn);
  const remove = useServerFn(deleteCheckIn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['staff', 'self-check-ins'], queryFn: () => list() as Promise<CheckInRow[]> });
  const [search, setSearch] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [printProperty, setPrintProperty] = useState<CheckInPropertyId | null>(null);
  const scope = useConsoleScope();
  const access = useConsoleAccess();
  const selected = useConsoleProperty();
  const properties = CHECK_IN_PROPERTIES.filter((p) => (scope === 'super' || p.id === 'XTSY-SHL-HOSTEL') && (!selected || p.id === selected));
  const [codes, setCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    void import('qrcode').then(async (QRCode) => {
      const entries = await Promise.all(CHECK_IN_PROPERTIES.map(async (p) => [p.id, await QRCode.toDataURL(checkInUrl(p.id), { width: 768, margin: 3, errorCorrectionLevel: 'M' })] as const));
      if (live) setCodes(Object.fromEntries(entries));
    }).catch(() => toast.error('Could not draw the QR codes.'));
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!printProperty || !codes[printProperty]) return;
    const clear = () => setPrintProperty(null);
    const frame = window.requestAnimationFrame(() => window.print());
    window.addEventListener('afterprint', clear, { once: true });
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('afterprint', clear); };
  }, [printProperty, codes]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      setDeleteCandidate(null);
      toast.success('Check-in and its uploaded documents deleted');
      void qc.invalidateQueries({ queryKey: ['staff'] });
      void qc.invalidateQueries({ queryKey: ['console'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (q.data ?? []).filter((r) => (!selected || r.propertyId === selected) && (!needle || [r.guestName, r.bookingReference, r.phone, r.email, r.city].some((v) => v.toLowerCase().includes(needle))));
  }, [q.data, search, selected]);

  const openDocument = async (id: string, kind: 'front' | 'back' | 'visa', mode: 'view' | 'download') => {
    const tab = window.open('about:blank', '_blank');
    try {
      const r = await documentLink({ data: { id, kind, mode } });
      if (tab) { tab.opener = null; tab.location.href = r.url; } else window.location.assign(r.url);
    } catch (e) {
      tab?.close();
      toast.error(e instanceof Error ? e.message : 'Could not open the document.');
    }
  };

  const print = CHECK_IN_PROPERTIES.find((p) => p.id === printProperty);
  return <>
    <div className="space-y-6 print:hidden">
      <PageHead title="Self check-in" sub="Guest arrivals, identity documents and room preferences. Allocate exact beds or rooms; each allocation holds that inventory on /book and in the console." />

      {properties.map((p) => <Panel key={p.id}>
        <div className="grid items-center gap-6 sm:grid-cols-[160px_1fr]">
          <div className="rounded-lg bg-background p-3">
            {codes[p.id] ? <img src={codes[p.id]} alt={`Self check-in QR — ${p.name}`} className="mx-auto h-36 w-36" /> : <QrCode className="mx-auto h-32 w-32 text-xt-ink" aria-hidden />}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-xt-ink">{p.name}</h2>
            <p className="mt-1 break-all text-sm text-xt-mute">{checkInUrl(p.id)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-[48px]" disabled={!codes[p.id]} onClick={() => setPrintProperty(p.id)}><Printer className="h-4 w-4" />Print A4 sign</Button>
              <Button variant="outline" className="min-h-[48px]" asChild><a href={checkInUrl(p.id)} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Open guest page</a></Button>
              <Button variant="outline" className="min-h-[48px]" onClick={() => void navigator.clipboard.writeText(checkInUrl(p.id)).then(() => toast.success('Check-in link copied'))}>Copy link</Button>
            </div>
          </div>
        </div>
      </Panel>)}

      <div className="relative"><Search className="absolute left-4 top-4 h-5 w-5 text-xt-mute" aria-hidden /><input aria-label="Search check-ins" className="min-h-[48px] w-full rounded-2xl border border-xt-line bg-white pl-12 pr-4 text-base text-xt-ink" placeholder="Search name, reference, phone, email or city" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {q.isLoading && <p className="text-xt-mute">Loading check-ins…</p>}
      {q.error && <p className="rounded-2xl bg-xt-blush p-4 text-sm text-xt-crimson-dark">{(q.error as Error).message}</p>}
      {!q.isLoading && rows.length === 0 && <Panel><p className="text-xt-mute">No matching self check-ins yet.</p></Panel>}

      <div className="space-y-4">{rows.map((r) => {
        const hasAllocation = r.allocatedUnits.length > 0 || !!r.allocationOverrideId;
        return <article key={r.id} className="rounded-[24px] border border-xt-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-xl font-extrabold text-xt-ink">{r.guestName}</h2><p className="mt-1 text-sm text-xt-mute">{propertyName(r.propertyId)}{r.bookingReference ? ` · ${r.bookingReference}` : ''}</p></div>
            <span className="rounded-full bg-xt-sand px-3 py-1 text-xs font-bold uppercase text-xt-ink">{r.status.replace('_', ' ')}</span>
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="font-bold text-xt-ink">Arrival</dt><dd className="text-xt-mute">{r.checkInDate} at {r.checkInTime}</dd></div>
            <div><dt className="font-bold text-xt-ink">Guests / purpose</dt><dd className="text-xt-mute">{r.totalGuests} · {r.purpose}</dd></div>
            <div><dt className="font-bold text-xt-ink">From</dt><dd className="text-xt-mute">{r.city}, {r.state}, {r.country}</dd></div>
            <div><dt className="font-bold text-xt-ink">Phone</dt><dd className="text-xt-mute"><a className="inline-flex min-h-[48px] items-center underline" href={`tel:${r.phone}`}>{r.phone}</a></dd></div>
            <div><dt className="font-bold text-xt-ink">Email</dt><dd className="break-all text-xt-mute"><a className="inline-flex min-h-[48px] items-center underline" href={`mailto:${r.email}`}>{r.email}</a></dd></div>
            <div><dt className="font-bold text-xt-ink">Traveller type</dt><dd className="text-xt-mute">{r.isInternational ? 'International · passport and visa' : 'Domestic · national ID'}</dd></div>
          </dl>
          {r.propertyId === 'XTSY-SHL-HOSTEL'
            ? <AllocationPanel row={r} all={q.data ?? []} />
            : <div className="mt-4 rounded-2xl bg-xt-cream p-4 text-sm"><span className="font-bold text-xt-ink">Guest chose:</span> <span className="text-xt-mute">{roomName(r.propertyId, r.roomTypeId)}. Camp tents are arranged on WhatsApp.</span></div>}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(['front', 'back', 'visa'] as const).map((kind) => r.documents[kind] && <div key={kind} className="rounded-2xl border border-xt-line p-3"><p className="flex items-center gap-2 text-sm font-bold text-xt-ink"><FileText className="h-4 w-4" aria-hidden />{kind === 'visa' ? 'Visa' : r.isInternational ? `Passport ${kind === 'front' ? 'first page' : 'last page'}` : `National ID ${kind}`}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => void openDocument(r.id, kind, 'view')} className="min-h-[48px] flex-1 rounded-full border border-xt-line text-sm font-bold text-xt-ink">View</button><button type="button" onClick={() => void openDocument(r.id, kind, 'download')} aria-label={`Download ${kind} document`} className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-xt-ink text-xt-sand"><Download className="h-4 w-4" aria-hidden /></button></div></div>)}
          </div>
          {access !== 'desk' && <div className="mt-5 border-t border-xt-line pt-4">
            {hasAllocation
              ? <p className="text-sm text-xt-mute">Release the room allocation before deleting this check-in.</p>
              : deleteCandidate === r.id
                ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-xt-blush p-4" role="alert">
                  <p className="max-w-xl text-sm text-xt-crimson-dark"><strong>Delete {r.guestName}’s check-in?</strong><br />This permanently removes the record and its uploaded identity documents.</p>
                  <div className="flex gap-2"><button type="button" className="min-h-[48px] rounded-full border border-xt-line bg-white px-4 text-sm font-bold" onClick={() => setDeleteCandidate(null)}>Cancel</button><button type="button" disabled={deleteMutation.isPending} className="min-h-[48px] rounded-full bg-xt-crimson px-4 text-sm font-bold text-white disabled:opacity-50" onClick={() => deleteMutation.mutate(r.id)}>{deleteMutation.isPending ? 'Deleting…' : 'Delete permanently'}</button></div>
                </div>
                : <button type="button" className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-xt-line px-4 text-sm font-bold text-xt-crimson" onClick={() => setDeleteCandidate(r.id)}><Trash2 className="h-4 w-4" aria-hidden />Delete check-in</button>}
          </div>}
        </article>;
      })}</div>
    </div>
    {print && codes[print.id] && createPortal(<CheckInQrSign property={print} code={codes[print.id]} url={checkInUrl(print.id)} />, document.body)}
  </>;
}
