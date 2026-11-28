import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useConsoleProperty } from '@/admin/consoleScope';
import { useServerFn } from '@tanstack/react-start';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { KeyRound, UserPlus } from 'lucide-react';
import { buildRouteHead } from '@/lib/seo-head';
import { createTeamMember, listTeam, setDeskLogins, setTeamMemberActive, setTeamMemberPassword } from '@/admin/team.functions';
import { canManageMember, TEAM_PROPERTIES, type TeamPropertyId, type TeamRole } from '@/admin/teamRules';
import { PageHead, Panel } from '@/admin/components/ConsoleBits';

export const Route = createFileRoute('/(admin)/admin/team')({
  head: () => buildRouteHead({ path: '/admin/team', title: 'Team & logins — XTSY Console', description: 'Property admins and front-desk logins per property.', noIndex: true }),
  component: TeamPage,
});

const NAMES: Record<string, string> = { 'XTSY-SHL-HOSTEL': 'XTSY Travellers Hostel', 'XTSY-SHN-CAMP': 'Shnonpedeng Riverside Camping by XTSY' };
const ROLE: Record<TeamRole, string> = { property_admin: 'Property admin', front_desk: 'Front desk' };
const field = 'min-h-12 w-full rounded-lg border border-xt-line bg-white px-3 text-base';

function TeamPage() {
  const selected = useConsoleProperty();
  const load = useServerFn(listTeam);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['console', 'team'], queryFn: () => load() });
  const done = (msg: string) => { toast.success(msg); void qc.invalidateQueries({ queryKey: ['console', 'team'] }); };
  const fail = (e: unknown) => toast.error((e as Error).message);
  const toggleDesk = useServerFn(setDeskLogins);
  const toggleMember = useServerFn(setTeamMemberActive);
  const desk = useMutation({ mutationFn: (v: { propertyId: TeamPropertyId; enabled: boolean }) => toggleDesk({ data: v }), onSuccess: (_r, v) => done(v.enabled ? 'Front-desk logins switched on' : 'Front-desk logins switched off'), onError: fail });
  const member = useMutation({ mutationFn: (v: { id: string; active: boolean }) => toggleMember({ data: v }), onSuccess: (_r, v) => done(v.active ? 'Login switched on' : 'Login switched off'), onError: fail });

  if (q.error) return <p className="text-destructive">Could not load the team. {(q.error as Error).message}</p>;
  if (!q.data) return <p className="text-muted-foreground">Loading…</p>;
  const props = TEAM_PROPERTIES.filter((p) => (q.data.isSuperAdmin || p === 'XTSY-SHL-HOSTEL') && (!selected || p === selected));

  return <div className="space-y-8">
    <PageHead title="Team & logins" sub="Logins use internal @xtsy.one emails with a first password you set. Staff cannot change it; the property admin or super admin changes it here." />
    {props.map((pid) => {
      const members = q.data.members.filter((m) => m.propertyId === pid);
      const deskOn = q.data.deskLogins[pid] ?? true;
      const canDesk = canManageMember(q.data.isSuperAdmin, pid, 'front_desk');
      return <section key={pid} aria-label={NAMES[pid]} className="space-y-4 border-b border-xt-line pb-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0"><h2 className="text-xl font-bold">{NAMES[pid]}</h2><p className="text-sm text-xt-mute">{members.length ? `${members.length} login${members.length === 1 ? '' : 's'}` : 'No console logins yet'}</p></div>
          {canDesk && <label className="flex min-h-12 shrink-0 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={deskOn} disabled={desk.isPending} onChange={(e) => desk.mutate({ propertyId: pid, enabled: e.target.checked })} />Front-desk logins on</label>}
        </div>
        {members.length > 0 && <ul className="divide-y divide-xt-line rounded-2xl border border-xt-line bg-white">{members.map((m) => <MemberRow key={m.id} m={m} deskOn={deskOn} onToggle={(active) => member.mutate({ id: m.id, active })} busy={member.isPending} />)}</ul>}
        <AddMember propertyId={pid} isSuperAdmin={q.data.isSuperAdmin} onDone={() => done('Login created')} />
      </section>;
    })}
  </div>;
}

type Member = { id: string; propertyId: string; role: TeamRole; email: string; name: string; active: boolean; isMe: boolean; canManage: boolean };

function MemberRow({ m, deskOn, onToggle, busy }: { m: Member; deskOn: boolean; onToggle: (active: boolean) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const change = useServerFn(setTeamMemberPassword);
  const save = useMutation({ mutationFn: () => change({ data: { id: m.id, password: pw } }), onSuccess: () => { toast.success(`Password changed for ${m.email}`); setPw(''); setOpen(false); }, onError: (e) => toast.error((e as Error).message) });
  const paused = m.role === 'front_desk' && !deskOn;
  return <li className="p-4 text-sm">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap">
      <div className="min-w-0 sm:flex-1"><p className="truncate font-semibold">{m.name || m.email}{m.isMe && ' (you)'}</p><p className="truncate text-xt-mute">{m.email} · {ROLE[m.role]} · {!m.active ? 'Switched off' : paused ? 'Paused (front desk off)' : 'Active'}</p></div>
      {m.canManage && <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex min-h-12 items-center gap-1.5 rounded-full border border-xt-line px-4 font-semibold"><KeyRound className="h-4 w-4" aria-hidden />Password</button>
        <button type="button" disabled={busy} onClick={() => onToggle(!m.active)} className="min-h-12 rounded-full border border-xt-line px-4 font-semibold disabled:opacity-50">{m.active ? 'Switch off' : 'Switch on'}</button>
      </div>}
    </div>
    {open && <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-3 flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-xs text-xt-mute">New password (10+ characters)<input type="text" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={field} /></label>
      <button type="submit" disabled={save.isPending || pw.length < 10} className="min-h-12 rounded-full bg-xt-ink px-5 font-bold text-xt-sand disabled:opacity-50">Save password</button>
    </form>}
  </li>;
}

function AddMember({ propertyId, isSuperAdmin, onDone }: { propertyId: TeamPropertyId; isSuperAdmin: boolean; onDone: () => void }) {
  const roles = (['front_desk', 'property_admin'] as const).filter((r) => canManageMember(isSuperAdmin, propertyId, r));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', role: roles[0] ?? 'front_desk' as TeamRole });
  const create = useServerFn(createTeamMember);
  const m = useMutation({ mutationFn: () => create({ data: { ...f, propertyId } }), onSuccess: () => { setF({ name: '', email: '', password: '', role: roles[0] ?? 'front_desk' }); setOpen(false); onDone(); }, onError: (e) => toast.error((e as Error).message) });
  if (!roles.length) return null;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-xt-ink px-5 text-sm font-semibold text-xt-sand"><UserPlus className="h-4 w-4" aria-hidden />Add login</button>;
  const submit = (e: FormEvent) => { e.preventDefault(); m.mutate(); };
  return <Panel title="New login">
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-xt-mute">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={field} placeholder="Front desk – evening" /></label>
      <label className="text-xs text-xt-mute">Internal email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={field} placeholder="desk1@xtsy.one" /></label>
      <label className="text-xs text-xt-mute">First password (10+ characters)<input type="text" required minLength={10} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={field} /></label>
      <label className="text-xs text-xt-mute">Role<select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as TeamRole })} className={field}>{roles.map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}</select></label>
      <p className="text-xs text-xt-mute sm:col-span-2">Front desk sees only Self check-in for this property: guest details, documents and room allocation.</p>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={m.isPending} className="min-h-12 rounded-full bg-xt-ink px-5 font-bold text-xt-sand disabled:opacity-50">{m.isPending ? 'Creating…' : 'Create login'}</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-full border border-xt-line px-5 font-semibold">Cancel</button>
      </div>
    </form>
  </Panel>;
}
