import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getBookingEngineStatus, saveBookingSettings, setBookingLaunchSwitch } from '@/admin/bookingConsole.functions';
import { NotSetUp, inr, selectCls } from '@/admin/components/engineBits';
import { BOOKING_ROOM_TYPES, unitLabel } from '@/booking/catalogue';
import type { SettingsInput } from '@/booking/consoleSettings';
import { GST_ON_FEE_BPS, PAYMENT_METHODS, ZOHO_PLATFORM_FEE_BPS } from '@/booking/payments/fees';
import { GST_SLAB_OPTIONS, slabMismatch, type GstSlab } from '@/booking/tax';

export const Route = createFileRoute('/(admin)/admin/booking-engine')({ component: BookingEngine });

function SlabPicker({ id, value, onChange }: { id: string; value: GstSlab; onChange: (s: GstSlab) => void }) {
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
      <select id={id} className={selectCls} value={value.kind} onChange={(e) => {
        const k = e.target.value;
        onChange(k === 'custom' ? { kind: 'custom', bps: 500, note: '' } : { kind: k as '5' | '18' });
      }}>
        {GST_SLAB_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {value.kind === 'custom' && (
        <div className="flex gap-2">
          <Input aria-label="Custom GST %" type="number" step="0.01" min={0} max={28} className="h-12 w-24 text-base" value={value.bps / 100}
            onChange={(e) => onChange({ ...value, bps: Math.round(Number(e.target.value) * 100) })} />
          <Input aria-label="Reason for custom rate" placeholder="Reason (e.g. CA advice)" className="h-12 text-base" value={value.note}
            onChange={(e) => onChange({ ...value, note: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function BookingEngine() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getBookingEngineStatus);
  const { data, error } = useQuery({ queryKey: ['engine', 'status'], queryFn: () => fetchStatus() });
  const save = useServerFn(saveBookingSettings);
  const flip = useServerFn(setBookingLaunchSwitch);
  const toForm = (s: { activeGateway: SettingsInput['activeGateway']; holdMinutes: number; feeTable: SettingsInput['feeTable']; gstSlabs: SettingsInput['gstSlabs']; breakfastGst: SettingsInput['breakfastGst'] }): SettingsInput =>
    ({ activeGateway: s.activeGateway, holdMinutes: s.holdMinutes, feeTable: s.feeTable, gstSlabs: s.gstSlabs, breakfastGst: s.breakfastGst });
  const [form, setForm] = useState<SettingsInput | null>(() => (data?.dbReady ? toForm(data.settings) : null));

  useEffect(() => {
    if (data?.dbReady && !form) setForm(toForm(data.settings));
  }, [data, form]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['engine'] });
  const saveM = useMutation({
    mutationFn: () => save({ data: form! }),
    onSuccess: (r) => { r.warnings.length ? r.warnings.forEach((w) => toast.warning(w)) : toast.success('Settings saved'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const flipM = useMutation({
    mutationFn: (on: boolean) => flip({ data: { on } }),
    onSuccess: (r) => { toast.success(r.on ? 'Live booking is on' : 'Live booking is off'); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  if (error) return <p className="text-destructive">Could not load the booking engine.</p>;
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  if (!data.dbReady) return <NotSetUp />;
  if (!form) return <p className="text-muted-foreground">Loading…</p>;
  const live = data.settings.engineSwitchedOn && data.blockers.length === 0;
  const setFee = (m: keyof SettingsInput['feeTable'], pct: number) => setForm({ ...form, feeTable: { ...form.feeTable, [m]: { bps: Math.round(pct * 100) } } });

  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle>Launch switch</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={live ? 'default' : 'secondary'}>{live ? 'Live booking on /book' : 'WhatsApp enquiries on /book'}</Badge>
          {data.settings.engineSwitchedOn
            ? <Button variant="outline" className="min-h-12" onClick={() => flipM.mutate(false)} disabled={flipM.isPending}>Switch live booking off</Button>
            : <Button className="min-h-12" onClick={() => flipM.mutate(true)} disabled={flipM.isPending}>Switch live booking on</Button>}
        </div>
        {data.blockers.length > 0 && (
          <div><p className="text-sm font-medium">Live booking cannot start until:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{data.blockers.map((b) => <li key={b}>{b}</li>)}</ul></div>
        )}
        <p className="text-xs text-muted-foreground">Without STAAH, an OTA and the website could sell the same bed, so the switch stays locked until STAAH is connected and every room is mapped.</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>GST slab per room type</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Hotel stays: 5% up to ₹7,500 per unit per night, 18% above. A slab that does not match the rate is saved with a warning.</p>
        {BOOKING_ROOM_TYPES.map((r) => {
          const slab = form.gstSlabs[r.id];
          const warn = slab ? slabMismatch(r.rate, slab) : null;
          return (
            <div key={r.id} className="grid gap-2 border-t border-border pt-3 md:grid-cols-[1.2fr_2fr] md:items-center">
              <Label htmlFor={`gst-${r.id}`}>{r.name}<span className="block text-xs font-normal text-muted-foreground">{inr(r.rate)} {unitLabel(r)} · {r.units} {r.soldAs === 'bed' ? 'beds' : r.units === 1 ? 'room' : 'rooms'}</span></Label>
              <div><SlabPicker id={`gst-${r.id}`} value={slab} onChange={(s) => setForm({ ...form, gstSlabs: { ...form.gstSlabs, [r.id]: s } })} />
                {warn && <p className="mt-1 text-xs text-amber-600">{warn}</p>}</div>
            </div>
          );
        })}
        <div className="grid gap-2 border-t border-border pt-3 md:grid-cols-[1.2fr_2fr] md:items-center">
          <Label htmlFor="gst-breakfast">Breakfast (TAB Bistro)<span className="block text-xs font-normal text-muted-foreground">Items picked from the TAB Bistro menu</span></Label>
          <SlabPicker id="gst-breakfast" value={form.breakfastGst} onChange={(s) => setForm({ ...form, breakfastGst: s })} />
        </div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Gateway charges per payment method</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Zoho adds this charge at checkout (convenience fee), plus 18% GST on it. Set each to what Zoho enables on your account. A charge cannot exceed Zoho's own fee.</p>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="py-2">Method</th><th>Charge to guest (%)</th><th>Zoho's fee</th><th>On a ₹1,000 payment</th></tr></thead>
          <tbody>{PAYMENT_METHODS.map((m) => {
            const bps = form.feeTable[m.id].bps;
            const fee = Math.round(100000 * bps / 10000), gst = Math.round(fee * GST_ON_FEE_BPS / 10000);
            return (
              <tr key={m.id} className="border-t border-border">
                <td className="py-2">{m.label}</td>
                <td><Input aria-label={`${m.label} charge`} type="number" step="0.01" min={0} max={ZOHO_PLATFORM_FEE_BPS[m.id] / 100} className="h-12 w-28 text-base" value={bps / 100} onChange={(e) => setFee(m.id, Number(e.target.value))} /></td>
                <td>{ZOHO_PLATFORM_FEE_BPS[m.id] / 100}%</td>
                <td>{bps ? `${inr(fee)} + ${inr(gst)} GST` : 'No charge'}</td>
              </tr>
            );
          })}</tbody></table></div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Checkout</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <div><Label htmlFor="gw">Payment gateway</Label>
          <select id="gw" className={selectCls} value={form.activeGateway} onChange={(e) => setForm({ ...form, activeGateway: e.target.value as 'zoho' | 'razorpay' })}>
            <option value="zoho">Zoho Payments</option>
            <option value="razorpay">Razorpay (not connected yet)</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">Keys: {data.state.gatewayConfigured ? 'saved' : 'not saved yet'}. Zoho accepts India-issued cards only.</p></div>
        <div><Label htmlFor="hold">Room hold during checkout (minutes)</Label>
          <Input id="hold" type="number" min={5} max={15} className="h-12 text-base" value={form.holdMinutes} onChange={(e) => setForm({ ...form, holdMinutes: Number(e.target.value) })} />
          <p className="mt-1 text-xs text-muted-foreground">5–15. Zoho's checkout stays open for at most 15 minutes.</p></div>
      </CardContent></Card>

      <Button className="min-h-12" onClick={() => saveM.mutate()} disabled={saveM.isPending}>{saveM.isPending ? 'Saving…' : 'Save settings'}</Button>
    </div>
  );
}
