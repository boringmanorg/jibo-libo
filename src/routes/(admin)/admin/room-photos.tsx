import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { roomContent } from '@/booking/roomContent';
import { getAdminSupabase } from '@/admin/adminSupabase';
import { addRoomPhotoFn, deleteRoomPhotoFn, listRoomPhotosFn, reorderRoomPhotosFn, updateRoomPhotoAltFn } from '@/admin/engineOps.functions';
import type { AdminPhoto } from '@/admin/engineOps.core';

export const Route = createFileRoute('/(admin)/admin/room-photos')({ component: RoomPhotos });

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

function RoomPhotos() {
  const list = useServerFn(listRoomPhotosFn);
  const q = useQuery({ queryKey: ['engine', 'room-photos'], queryFn: () => list() });
  const byRoom = (id: string) => (q.data ?? []).filter((p) => p.roomTypeId === id).sort((a, b) => a.sort - b.sort);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Room photos</h2>
        <p className="text-sm text-muted-foreground">
          Photos you upload here replace the built-in ones on the booking page, in the order shown. Remove them all to go back to the built-in photos.
          JPG, PNG, WebP or AVIF, up to 8 MB each. The first photo is the card photo.
        </p>
      </div>
      {q.error && <p className="rounded-md border border-destructive/40 p-3 text-sm">{(q.error as Error).message}. If this is the first time, publish the site so the photo tables are created.</p>}
      {BOOKING_ROOM_TYPES.map((r) => <RoomPhotoCard key={r.id} roomTypeId={r.id} name={r.name} photos={byRoom(r.id)} loading={q.isLoading} />)}
    </div>
  );
}

function RoomPhotoCard({ roomTypeId, name, photos, loading }: { roomTypeId: string; name: string; photos: AdminPhoto[]; loading: boolean }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['engine', 'room-photos'] });
  const add = useServerFn(addRoomPhotoFn);
  const del = useServerFn(deleteRoomPhotoFn);
  const reorder = useServerFn(reorderRoomPhotosFn);
  const [busy, setBusy] = useState(false);
  const defaults = roomContent(roomTypeId).images;

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let done = 0;
    try {
      const sb = await getAdminSupabase();
      for (const file of Array.from(files)) {
        if (!TYPES.includes(file.type)) { toast.error(`${file.name}: use JPG, PNG, WebP or AVIF.`); continue; }
        if (file.size > MAX_BYTES) { toast.error(`${file.name} is over 8 MB.`); continue; }
        const path = `${roomTypeId}/${crypto.randomUUID()}.${EXT[file.type]}`;
        const up = await sb.storage.from('room-photos').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
        if (up.error) { toast.error(`${file.name}: ${up.error.message}`); continue; }
        await add({ data: { roomTypeId, path, alt: `${name}` } });
        done += 1;
      }
      if (done) toast.success(`${done} photo${done > 1 ? 's' : ''} added to ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const move = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { roomTypeId, ids } }),
    onSuccess: () => refresh(),
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success('Photo deleted'); void refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const swap = (i: number, j: number) => {
    const ids = photos.map((p) => p.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    move.mutate(ids);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-lg">{name}</CardTitle>
        <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 has-[:disabled]:opacity-50">
          <ImagePlus className="h-4 w-4" aria-hidden /> {busy ? 'Uploading…' : 'Upload photos'}
          <input type="file" accept={TYPES.join(',')} multiple className="sr-only" disabled={busy} onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
        </label>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : photos.length === 0 ? (
          <div>
            <p className="mb-3 text-sm text-muted-foreground">No uploaded photos. The booking page shows these built-in photos{roomTypeId === 'triple-room-with-mountain-view' ? ' (the King room’s, until you add the triple room’s own)' : ''}:</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {defaults.slice(0, 6).map((src) => <img key={src} src={src} alt="" className="h-20 w-28 shrink-0 rounded-md object-cover opacity-80" />)}
              {defaults.length === 0 && <p className="text-sm">None yet.</p>}
            </div>
          </div>
        ) : (
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p, i) => (
              <li key={p.id} className="overflow-hidden rounded-lg border border-border">
                <div className="relative">
                  <img src={p.url} alt={p.alt} className="aspect-[4/3] w-full object-cover" />
                  {i === 0 && <span className="absolute left-2 top-2 rounded bg-background/90 px-2 py-0.5 text-xs font-medium">Card photo</span>}
                </div>
                <div className="space-y-2 p-3">
                  <CaptionField photo={p} onSaved={refresh} />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1">
                      <Button size="icon" variant="outline" className="h-11 w-11" disabled={i === 0 || move.isPending} onClick={() => swap(i, i - 1)} aria-label="Move earlier"><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="outline" className="h-11 w-11" disabled={i === photos.length - 1 || move.isPending} onClick={() => swap(i, i + 1)} aria-label="Move later"><ArrowDown className="h-4 w-4" /></Button>
                    </div>
                    <Button variant="outline" className="min-h-11 text-destructive" disabled={remove.isPending}
                      onClick={() => { if (window.confirm('Delete this photo? It is removed from the booking page straight away.')) remove.mutate(p.id); }}>
                      <Trash2 className="mr-1 h-4 w-4" aria-hidden /> Delete
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function CaptionField({ photo, onSaved }: { photo: AdminPhoto; onSaved: () => void }) {
  const save = useServerFn(updateRoomPhotoAltFn);
  const [alt, setAlt] = useState(photo.alt);
  const m = useMutation({ mutationFn: () => save({ data: { id: photo.id, alt } }), onSuccess: () => { toast.success('Caption saved'); onSaved(); }, onError: (e) => toast.error(e.message) });
  return (
    <div className="flex gap-2">
      <Input aria-label="Photo description for screen readers" placeholder="Describe the photo" className="h-11 text-base" value={alt} maxLength={160} onChange={(e) => setAlt(e.target.value)} />
      <Button variant="secondary" className="min-h-11" disabled={alt === photo.alt || m.isPending} onClick={() => m.mutate()}>Save</Button>
    </div>
  );
}
