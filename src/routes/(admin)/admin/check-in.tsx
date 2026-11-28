import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Printer, QrCode, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHead, Panel } from '@/admin/components/ConsoleBits';
import { getCheckInDocumentFn, listCheckInsFn } from '@/checkin/checkIn.functions';
import { CHECK_IN_PROPERTIES, roomPreferences, type CheckInPropertyId } from '@/checkin/checkInModel';
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
  isInternational: boolean; roomTypeId: string; status: string; createdAt: string; documents: { front: boolean; back: boolean; visa: boolean };
};

const propertyName = (id: string) => CHECK_IN_PROPERTIES.find((p) => p.id === id)?.name ?? id;
const roomName = (propertyId: CheckInPropertyId, id: string) => roomPreferences(propertyId).find((r) => r.id === id)?.name ?? id;

function CheckInDesk() {
  const list = useServerFn(listCheckInsFn);
  const documentLink = useServerFn(getCheckInDocumentFn);
  const q = useQuery({ queryKey: ['staff', 'self-check-ins'], queryFn: () => list() as Promise<CheckInRow[]> });
  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState('https://xtsy.one');
  const [qr, setQr] = useState('');

  useEffect(() => {
    const url = `${window.location.origin}/check-in`;
    setOrigin(window.location.origin);
    let live = true;
    void import('qrcode').then((QRCode) => QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: 'M' })).then((value) => { if (live) setQr(value); }).catch(() => toast.error('Could not draw the QR code.'));
    return () => { live = false; };
  }, []);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (q.data ?? []).filter((r) => !needle || [r.guestName, r.bookingReference, r.phone, r.email, r.city].some((v) => v.toLowerCase().includes(needle)));
  }, [q.data, search]);

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

  return <div className="space-y-6">
    <PageHead title="Self check-in" sub="Guest arrivals, identity documents and room preferences. Allocate rooms or beds in the existing booking tools." />

    <Panel>
      <div className="grid items-center gap-6 sm:grid-cols-[160px_1fr]">
        <div className="rounded-2xl bg-white p-3 print:fixed print:inset-0 print:flex print:items-center print:justify-center">
          {qr ? <img src={qr} alt="QR code opening the XTSY self check-in page" className="mx-auto h-36 w-36 print:h-80 print:w-80" /> : <QrCode className="mx-auto h-32 w-32 text-xt-ink" aria-hidden />}
        </div>
        <div className="print:hidden">
          <h2 className="text-lg font-extrabold text-xt-ink">Front-desk QR sign</h2>
          <p className="mt-1 text-sm text-xt-mute">Guests scan this code to open <span className="font-mono">{origin}/check-in</span>. No app or sign-in is needed.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-xt-ink px-4 text-sm font-bold text-xt-sand" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Print QR sign</button>
            <a href={`${origin}/check-in`} target="_blank" rel="noreferrer" className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-xt-line px-4 text-sm font-bold text-xt-ink"><ExternalLink className="h-4 w-4" aria-hidden />Open guest page</a>
            <button type="button" className="min-h-[48px] rounded-full border border-xt-line px-4 text-sm font-bold text-xt-ink" onClick={() => void navigator.clipboard.writeText(`${origin}/check-in`).then(() => toast.success('Check-in link copied'))}>Copy link</button>
          </div>
        </div>
      </div>
    </Panel>

    <div className="relative print:hidden"><Search className="absolute left-4 top-4 h-5 w-5 text-xt-mute" aria-hidden /><input aria-label="Search check-ins" className="min-h-[48px] w-full rounded-2xl border border-xt-line bg-white pl-12 pr-4 text-base text-xt-ink" placeholder="Search name, reference, phone, email or city" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    {q.isLoading && <p className="text-xt-mute">Loading check-ins…</p>}
    {q.error && <p className="rounded-2xl bg-xt-blush p-4 text-sm text-xt-crimson-dark">{(q.error as Error).message}</p>}
    {!q.isLoading && rows.length === 0 && <Panel><p className="text-xt-mute">No matching self check-ins yet.</p></Panel>}

    <div className="space-y-4 print:hidden">{rows.map((r) => <article key={r.id} className="rounded-[24px] border border-xt-line bg-white p-5">
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
      <div className="mt-4 rounded-2xl bg-xt-cream p-4 text-sm"><span className="font-bold text-xt-ink">Preference only:</span> <span className="text-xt-mute">{roomName(r.propertyId, r.roomTypeId)}. Actual room/bed allocation stays with the desk.</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {(['front', 'back', 'visa'] as const).map((kind) => r.documents[kind] && <div key={kind} className="rounded-2xl border border-xt-line p-3"><p className="flex items-center gap-2 text-sm font-bold text-xt-ink"><FileText className="h-4 w-4" aria-hidden />{kind === 'visa' ? 'Visa' : r.isInternational ? `Passport ${kind === 'front' ? 'first page' : 'last page'}` : `National ID ${kind}`}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => void openDocument(r.id, kind, 'view')} className="min-h-[48px] flex-1 rounded-full border border-xt-line text-sm font-bold text-xt-ink">View</button><button type="button" onClick={() => void openDocument(r.id, kind, 'download')} aria-label={`Download ${kind} document`} className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-xt-ink text-xt-sand"><Download className="h-4 w-4" aria-hidden /></button></div></div>)}
      </div>
    </article>)}</div>
  </div>;
}
