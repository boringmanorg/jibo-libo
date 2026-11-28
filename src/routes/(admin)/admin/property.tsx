import { buildRouteHead } from '@/lib/seo-head';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useConsoleProperty } from '@/admin/consoleScope';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { CAMP_ID } from '@/admin/consoleProperties';
import { logoFor } from '@/data/platformLogos';
import { AMENITIES, OTA_PLATFORMS, PROPERTY_TYPES, type PlaceHit, type PropertyProfile, type PropertyType } from '@/property/propertySetup';
import { getPropertyProfileFn, savePropertyProfileFn, searchPlacesFn, syncGooglePlaceFn } from '@/property/propertySetup.functions';

export const Route = createFileRoute('/(admin)/admin/property')({
  head: () => buildRouteHead({ path: '/admin/property', title: 'Property setup — XTSY Console', description: 'Property details, location, amenities, rooms and listings.', noIndex: true }),
  component: PropertySetup,
});

type Draft = Pick<PropertyProfile, 'propertyType' | 'displayName' | 'description' | 'address' | 'latitude' | 'longitude' | 'amenities' | 'otaPresence' | 'hiddenRoomTypes'>;

function toggle(list: string[], v: string) { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; }

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm transition-colors ${on ? 'border-foreground bg-foreground text-background' : 'border-border bg-background hover:bg-muted'}`}>
      {children}
    </button>
  );
}

function PropertySetup() {
  const propertyId = (useConsoleProperty() ?? 'XTSY-SHL-HOSTEL') as 'XTSY-SHL-HOSTEL' | 'XTSY-SHN-CAMP';
  const qc = useQueryClient();
  const get = useServerFn(getPropertyProfileFn);
  const save = useServerFn(savePropertyProfileFn);
  const search = useServerFn(searchPlacesFn);
  const sync = useServerFn(syncGooglePlaceFn);
  const key = ['property-profile', propertyId];
  const q = useQuery({ queryKey: key, queryFn: () => get({ data: { propertyId } }) });
  const [d, setD] = useState<Draft | null>(null);
  useEffect(() => { if (q.data) setD({ propertyType: q.data.propertyType, displayName: q.data.displayName, description: q.data.description, address: q.data.address, latitude: q.data.latitude, longitude: q.data.longitude, amenities: q.data.amenities, otaPresence: q.data.otaPresence, hiddenRoomTypes: q.data.hiddenRoomTypes }); }, [q.data]);

  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const find = useMutation({ mutationFn: () => search({ data: { query: term } }), onSuccess: (r) => { setHits(r); if (!r.length) toast.message('No places found.'); }, onError: (e) => toast.error(e.message) });
  const pull = useMutation({ mutationFn: (placeId: string) => sync({ data: { propertyId, placeId } }), onSuccess: (r) => { qc.setQueryData(key, r); setHits([]); toast.success('Location and Google reviews copied to the console'); }, onError: (e) => toast.error(e.message) });
  const store = useMutation({ mutationFn: (x: Draft) => save({ data: { propertyId, ...x } }), onSuccess: () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ['public-property', propertyId] }); toast.success('Saved — now showing on /book'); }, onError: (e) => toast.error(e.message) });

  if (q.isLoading || !d) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const p = q.data!;
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });
  const rooms = propertyId === CAMP_ID ? [] : BOOKING_ROOM_TYPES;
  const mapKey = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'] as string | undefined;

  return (
    <div className="space-y-6 pb-28">
      <div>
        <h1 className="font-display text-4xl">Property setup</h1>
        <p className="text-sm text-muted-foreground">Everything here shows on www.xtsy.one/book once you save. Invoices are made automatically from bookings.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Property details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label htmlFor="pname">Property name</Label><Input id="pname" value={d.displayName} onChange={(e) => set({ displayName: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Property type</Label>
            <div className="flex flex-wrap gap-2">{PROPERTY_TYPES.map((t) => <Chip key={t} on={d.propertyType === t} onClick={() => set({ propertyType: t as PropertyType })}>{t}</Chip>)}</div>
          </div>
          <div className="space-y-2"><Label htmlFor="pdesc">Short description</Label><Textarea id="pdesc" rows={3} value={d.description} onChange={(e) => set({ description: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Location (Google Maps)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Input aria-label="Search Google Maps" placeholder="Search the property on Google Maps" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && term.trim().length >= 3) find.mutate(); }} />
            <Button className="min-h-[48px]" disabled={term.trim().length < 3 || find.isPending} onClick={() => find.mutate()}>Search</Button>
          </div>
          {hits.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border">
              {hits.map((h) => (
                <li key={h.placeId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3">
                  <span className="min-w-0"><span className="block font-medium">{h.name}</span><span className="block truncate text-sm text-muted-foreground">{h.address}</span></span>
                  <Button variant="outline" className="min-h-[48px]" disabled={pull.isPending} onClick={() => pull.mutate(h.placeId)}>Use this place</Button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2"><Label htmlFor="paddr">Address</Label><Textarea id="paddr" rows={2} value={d.address} onChange={(e) => set({ address: e.target.value })} /></div>
          {p.googlePlaceId && mapKey && (
            <iframe title="Property location" className="h-72 w-full rounded-lg border" loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
              src={`https://www.google.com/maps/embed/v1/place?key=${mapKey}&q=place_id:${p.googlePlaceId}`} />
          )}
          <p className="text-xs text-muted-foreground">{p.googleSyncedAt ? `Copied from Google once on ${new Date(p.googleSyncedAt).toLocaleString('en-IN')}. Nothing is ever sent to Google; search again to refresh.` : 'Search and pick the place to copy its pin, rating and reviews once. No Google account is needed.'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Google reviews</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {p.googleRating === null ? <p className="text-muted-foreground">Not copied yet.</p> : <p className="font-medium">{p.googleRating.toFixed(1)}★ from {p.googleReviewCount ?? 0} Google reviews</p>}
          <ul className="space-y-3">{p.googleReviews.map((r, i) => <li key={i} className="rounded-lg border p-3"><p className="font-medium">{r.author} · {'★'.repeat(Math.round(r.rating))} <span className="font-normal text-muted-foreground">{r.when}</span></p><p className="mt-1 text-muted-foreground">{r.text}</p></li>)}</ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Amenities</CardTitle></CardHeader>
        <CardContent><div className="flex flex-wrap gap-2">{AMENITIES.map((a) => <Chip key={a} on={d.amenities.includes(a)} onClick={() => set({ amenities: toggle(d.amenities, a) })}>{a}</Chip>)}</div></CardContent>
      </Card>

      {rooms.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Rooms on /book</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Remove a room type to stop showing it on /book; add it back any time. Inventory, prices and the sheet are not changed.</p>
            <ul className="divide-y divide-border">
              {rooms.map((r) => { const hidden = d.hiddenRoomTypes.includes(r.id); return (
                <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2">
                  <span className={`min-w-0 ${hidden ? 'text-muted-foreground line-through' : ''}`}>{r.name}</span>
                  <Button variant={hidden ? 'default' : 'outline'} className="min-h-[48px]" onClick={() => set({ hiddenRoomTypes: toggle(d.hiddenRoomTypes, r.id) })}>{hidden ? 'Add back' : 'Remove'}</Button>
                </li>); })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Where guests can find us</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Pick the platforms this property is listed on. /book shows their logos only — no links away from xtsy.one.</p>
          <div className="flex flex-wrap gap-2">{OTA_PLATFORMS.map((o) => { const logo = logoFor(o); return (
            <Chip key={o} on={d.otaPresence.includes(o)} onClick={() => set({ otaPresence: toggle(d.otaPresence, o) })}>
              {logo && <img src={logo.src} alt="" width={20} height={20} className="h-5 w-5 rounded object-contain" />}{o}
            </Chip>); })}</div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button className="min-h-[48px] px-8 shadow-lg" disabled={store.isPending || d.displayName.trim().length < 2} onClick={() => store.mutate(d)}>{store.isPending ? 'Saving…' : 'Save property'}</Button>
      </div>
    </div>
  );
}
