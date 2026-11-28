import { createFileRoute, Link, Navigate, Outlet, useRouterState, useNavigate } from '@tanstack/react-router';
import { PageHead } from '@/admin/components/ConsoleBits';
import { Activity, BookUser, CalendarDays, CreditCard, ExternalLink, Inbox, LogOut, Menu, PanelLeftClose, PanelLeftOpen, PlugZap, ScanLine, Sparkles, Sun, Users, X } from 'lucide-react';
import xtsyLogo from '@/assets/xtsy-color-logo.webp';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAdminSupabase, SUPER_ADMIN_EMAIL } from '@/admin/adminSupabase';
import { ConsoleAccessContext, ConsoleScopeContext, ConsolePropertyLock, hostelConsolePath } from '@/admin/consoleScope';
import { DESK_PATHS } from '@/admin/teamRules';
import { z } from 'zod';
import { CONSOLE_PROPERTIES, CAMP_ID } from '@/admin/consoleProperties';
import { deniedMessage, deniedReason, signInErrorMessage, type DeniedReason } from '@/admin/signInMessages';

export const Route = createFileRoute('/(admin)/admin')({
  ssr: false,
  validateSearch: z.object({
    property: z.enum(['XTSY-SHL-HOSTEL', 'XTSY-SHN-CAMP']).optional(),
    range: z.string().max(12).optional(),
    from: z.string().max(10).optional(),
    to: z.string().max(10).optional(),
  }),
  head: () => ({
    meta: [
      { title: 'XTSY Console' },
      { name: 'description', content: 'Private console for XTSY property operations and booking engine.' },
      { name: 'robots', content: 'noindex, nofollow' },
      { property: 'og:title', content: 'XTSY Super Admin Console' },
      { property: 'og:description', content: 'Private console for XTSY property operations and booking engine.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: AdminLayout,
});

type Status = 'loading' | 'out' | 'denied' | 'in' | 'recovery';
type Access = 'admin' | 'property' | 'desk';

function AdminLayout() {
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState<DeniedReason>('wrong_email');
  const [configError, setConfigError] = useState('');
  const [access, setAccess] = useState<Access>('admin');
  const [deskProperty, setDeskProperty] = useState<string>('XTSY-SHL-HOSTEL');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      let sb;
      try {
        sb = await getAdminSupabase();
      } catch (e) {
        if (!cancelled) { setConfigError(e instanceof Error ? e.message : String(e)); setStatus('out'); }
        return;
      }
      if (cancelled) return;
      const evaluate = async () => {
        const { data } = await sb.auth.getUser();
        const u = data.user;
        if (!u) return setStatus('out');
        setEmail(u.email ?? '');
        // Access comes from the database (super admin, or an active row in the property team).
        // Presentation only: every server function and RLS policy checks again.
        if (!u.email_confirmed_at) { setReason('unconfirmed'); return setStatus('denied'); }
        const { data: rows } = await sb.rpc('be_my_console_access');
        const list = (rows ?? []) as { property_id: string; role: string }[];
        setReason(deniedReason(u, SUPER_ADMIN_EMAIL));
        if (!list.length) return setStatus('denied');
        if (list.some((r) => r.role === 'super')) setAccess('admin');
        else if (list.some((r) => r.role === 'property_admin' && r.property_id === 'XTSY-SHL-HOSTEL')) setAccess('property');
        else { setAccess('desk'); setDeskProperty(list[0]!.property_id); }
        setStatus('in');
      };
      const { data: sub } = sb.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') return setStatus('recovery');
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void evaluate();
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      void evaluate();
    })();
    return () => { cancelled = true; unsubscribe?.(); };
  }, []);

  const signOut = async () => { await (await getAdminSupabase()).auth.signOut(); setStatus('out'); };

  return (
    <div className="xt-console">
      {status === 'loading' && <p className="p-10 text-center text-muted-foreground">Checking access…</p>}
      {status === 'out' && <SignIn configError={configError} />}
      {status === 'recovery' && <SetPassword onDone={() => setStatus('loading')} />}
      {status === 'denied' && (
        <div className="mx-auto max-w-md p-10 text-center">
          <h1 className="xt-display text-4xl">Access denied</h1>
          <p className="mt-2 text-muted-foreground">{deniedMessage(reason, email)}</p>
          <Button className="mt-6 min-h-12" onClick={signOut}>Sign out</Button>
        </div>
      )}
      {status === 'in' && <Shell email={email} access={access} deskProperty={deskProperty} onSignOut={signOut} />}
    </div>
  );
}

const NAV: { group: string; items: { to: string; label: string; icon: typeof CalendarDays; exact?: boolean; superOnly?: boolean }[] }[] = [
  { group: 'Property operations', items: [
    { to: '/admin', label: 'Today', icon: Sun, exact: true },
    { to: '/admin/inventory', label: 'Inventory', icon: CalendarDays },
    { to: '/admin/inbox', label: 'Sales', icon: Inbox },
    { to: '/admin/guest-folio', label: 'Guest Folio', icon: BookUser },
    { to: '/admin/check-in', label: 'Self check-in', icon: ScanLine },
    { to: '/admin/pricing', label: 'Smart pricing', icon: Sparkles, superOnly: true },
  ] },
  { group: 'Set up', items: [
    { to: '/admin/booking-engine', label: 'Booking Config', icon: CreditCard },
    { to: '/admin/settings', label: 'Connections', icon: PlugZap, superOnly: true },
    { to: '/admin/team', label: 'Team & logins', icon: Users, superOnly: true },
  ] },
  { group: 'Insights', items: [
    { to: '/admin/live', label: 'Live insights', icon: Activity },
  ] },
];

/** Titles for the older screens that don't draw their own heading. */
const OLD_SCREEN_TITLES: Record<string, [string, string]> = {
  '/admin/room-photos': ['Room photos', 'The photos /book shows for each room.'],
  '/admin/booking-engine': ['Booking Config', 'Property details guests see on /book, and online payment, fees and GST.'],
  '/admin/bookings': ['Paid bookings', 'Bookings paid online through /book.'],
  '/admin/invoices': ['Invoices', 'Advance receipts and tax invoices.'],
};

function Shell({ email, access, deskProperty, onSignOut }: { email: string; access: Access; deskProperty: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const path = useRouterState({ select: (st) => st.location.pathname.replace(/\/$/, '') });
  const selected = Route.useSearch().property;
  const allView = ['/admin', '/admin/check-in', '/admin/inbox', '/admin/guest-folio', '/admin/live'].includes(path);
  type Pid = 'XTSY-SHL-HOSTEL' | 'XTSY-SHN-CAMP';
  const lock: Pid | undefined = access === 'desk' ? (deskProperty === CAMP_ID ? CAMP_ID : 'XTSY-SHL-HOSTEL') : access === 'property' ? 'XTSY-SHL-HOSTEL' : undefined;
  const property = lock ?? selected ?? (allView ? undefined : 'XTSY-SHL-HOSTEL');
  const navigate = useNavigate({ from: Route.fullPath });
  const deskPath = (p: string) => (DESK_PATHS as readonly string[]).includes(p);
  const allowed = (p: string) => access === 'admin' || (access === 'property' ? hostelConsolePath(p) : deskPath(p));
  if (!allowed(path)) return <Navigate to="/admin/check-in" search={{ property: lock }} replace />;
  const oldTitle = OLD_SCREEN_TITLES[path];
  const hostelOnly = ['/admin/inventory', '/admin/stays', '/admin/room-photos', '/admin/bookings'];
  const campUnsupported = property === CAMP_ID && hostelOnly.includes(path);
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => (!i.superOnly || access === 'admin') && allowed(i.to)) })).filter((g) => g.items.length);
  const renderNav = (compact = false) => (
    <nav aria-label="Console" className="space-y-6">
      {groups.map((g) => (
        <div key={g.group}>
          {!compact && <p className="px-3 pb-1.5 text-xs font-semibold text-muted-foreground">{g.group}</p>}
          <ul className="space-y-1">
            {g.items.map(({ to, label, icon: Icon, exact }) => (
              <li key={to}>
                <Link to={to} search={{ property: property ?? (['/admin', '/admin/check-in', '/admin/inbox', '/admin/guest-folio', '/admin/live'].includes(to) ? undefined : 'XTSY-SHL-HOSTEL') }} activeOptions={{ exact: !!exact }} onClick={() => setOpen(false)}
                  aria-label={compact ? label : undefined} title={compact ? label : undefined}
                  className={`flex min-h-12 items-center rounded-xl text-[15px] font-semibold text-xt-mute transition-colors hover:bg-xt-cream hover:text-xt-ink [&.active]:bg-xt-ink [&.active]:text-xt-sand ${compact ? 'justify-center px-0' : 'gap-3 px-3'}`}>
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />{!compact && label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="border-t border-xt-line pt-4">
        <a href="/book" target="_blank" rel="noreferrer" aria-label={compact ? 'Open guest booking page' : undefined} title={compact ? 'Open /book' : undefined} className={`flex min-h-12 items-center rounded-xl text-[15px] font-semibold text-xt-mute hover:bg-xt-cream hover:text-xt-ink ${compact ? 'justify-center px-0' : 'gap-3 px-3'}`}>
          <ExternalLink className="h-[18px] w-[18px]" aria-hidden />{!compact && 'Open /book'}
        </a>
      </div>
    </nav>
  );
  return (
    <div className={`lg:grid lg:min-h-screen ${collapsed ? 'lg:grid-cols-[80px_1fr]' : 'lg:grid-cols-[256px_1fr]'}`}>
      <aside className={`sticky top-0 hidden h-screen h-[100dvh] border-r border-xt-line bg-white/70 py-5 lg:flex lg:flex-col print:hidden ${collapsed ? 'px-2' : 'px-4'}`}>
        <div className={`flex shrink-0 ${collapsed ? 'flex-col items-center gap-3' : 'items-center justify-between gap-2'}`}>
          <Brand compact={collapsed} />
          <button type="button" onClick={() => { setCollapsed((v) => !v); document.getElementById('console-sidebar-nav')?.scrollTo({ top: 0 }); }} aria-expanded={!collapsed} aria-controls="console-sidebar-nav"
            aria-label={collapsed ? 'Expand console sidebar' : 'Collapse console sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-xt-line bg-white text-xt-mute hover:text-xt-ink">
            {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden /> : <PanelLeftClose className="h-5 w-5" aria-hidden />}
          </button>
        </div>
        <div id="console-sidebar-nav" className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain">{renderNav(collapsed)}</div>
        <div className="mt-4 shrink-0"><Account email={email} onSignOut={onSignOut} compact={collapsed} /></div>
      </aside>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-xt-line bg-xt-sand/95 px-4 backdrop-blur lg:hidden print:hidden">
        <Brand />
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="console-nav"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-xt-line bg-white" aria-label={open ? 'Close menu' : 'Open menu'}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {open && (
        <div id="console-nav" className="fixed inset-x-0 top-16 z-30 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-b border-xt-line bg-xt-sand px-4 py-5 shadow-lg lg:hidden">
          {renderNav()}
          <div className="mt-4"><Account email={email} onSignOut={onSignOut} /></div>
        </div>
      )}
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-xt-line bg-white/80 p-2 pl-4 shadow-sm print:hidden">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-xt-mute">
              <span className={`h-2 w-2 rounded-full ${access === 'admin' ? 'bg-xt-crimson' : 'bg-xt-leaf'}`} aria-hidden />
              {access === 'admin' ? 'Super admin' : access === 'property' ? 'Property admin' : 'Front desk'}
            </span>
            <div role="group" aria-label="Console property" className="flex flex-wrap gap-1">
              {[...(access === 'admin' && allView ? [{ id: '', name: 'All properties' }] : []), ...CONSOLE_PROPERTIES.filter((p) => access === 'admin' || p.id === lock)].map((p) => {
                const on = (property ?? '') === p.id;
                return (
                  <button key={p.id || 'all'} type="button" aria-pressed={on} disabled={access !== 'admin'} onClick={() => void navigate({ to: path, search: (prev) => ({ ...prev, property: p.id === CAMP_ID ? CAMP_ID : p.id === 'XTSY-SHL-HOSTEL' ? 'XTSY-SHL-HOSTEL' : undefined }) })}
                    className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ${on ? 'bg-xt-ink text-xt-sand' : 'text-xt-mute hover:bg-xt-cream hover:text-xt-ink'} disabled:cursor-default`}>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          {oldTitle && <PageHead title={oldTitle[0]} sub={oldTitle[1]} />}
          <ConsoleAccessContext.Provider value={access}><ConsolePropertyLock.Provider value={lock}><ConsoleScopeContext.Provider value={access === 'admin' ? 'super' : 'hostel'}>{campUnsupported ? <div className="space-y-4"><h2 className="text-xl font-bold">Shnonpedeng Riverside Camping by XTSY</h2><p className="text-muted-foreground">WhatsApp enquiry-only. No live inventory, online payment or hostel connections apply to this property.</p><Link to="/admin" search={{ property: CAMP_ID }} className="inline-flex min-h-[48px] items-center underline">View property overview</Link></div> : <Outlet key={property ?? 'all'} />}</ConsoleScopeContext.Provider></ConsolePropertyLock.Provider></ConsoleAccessContext.Provider>
        </div>
      </main>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/admin" className="flex min-h-12 items-center gap-2.5" aria-label="XTSY console home">
      <img src={xtsyLogo} alt="XTSY" width={120} height={28} className={compact ? 'h-8 w-12 object-contain' : 'h-7 w-auto'} />
      {!compact && <span className="rounded-full bg-xt-ink px-2.5 py-0.5 text-xs font-bold text-xt-sand">Console</span>}
    </Link>
  );
}

function Account({ email, onSignOut, compact = false }: { email: string; onSignOut: () => void; compact?: boolean }) {
  return (
    <div className={`flex items-center rounded-2xl bg-xt-cream ${compact ? 'justify-center p-2' : 'justify-between gap-2 p-3'}`}>
      {!compact && <p className="min-w-0 truncate text-sm text-xt-mute" title={email}>{email}</p>}
      <button type="button" onClick={onSignOut} aria-label={compact ? 'Sign out' : undefined} title={compact ? 'Sign out' : undefined} className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-xt-ink hover:bg-white">
        <LogOut className="h-4 w-4" aria-hidden />{!compact && 'Sign out'}
      </button>
    </div>
  );
}

function SignIn({ configError = '' }: { configError?: string }) {
  const [email, setEmail] = useState(SUPER_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(configError);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    let error;
    try {
      ({ error } = await (await getAdminSupabase()).auth.signInWithPassword({ email, password }));
    } catch (e) {
      setBusy(false);
      return setMsg(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
    if (error) setMsg(signInErrorMessage(error));
  };
  const reset = async () => {
    const { error } = await (await getAdminSupabase()).auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin` });
    setMsg(error ? 'Could not send reset email.' : 'Password reset email sent.');
  };
  return (
    <form onSubmit={submit} className="mx-auto mt-16 max-w-sm space-y-4 rounded-[28px] border border-border bg-card p-7 shadow-sm">
      <img src={xtsyLogo} alt="XTSY" width={120} height={28} className="h-7 w-auto" />
      <h1 className="xt-display text-4xl leading-none">Console sign-in</h1>
      <div className="space-y-1"><Label htmlFor="em">Email</Label><Input id="em" type="email" className="text-base" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div className="space-y-1"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" className="text-base" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      <Button type="submit" className="min-h-12 w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      <Button type="button" variant="ghost" className="min-h-12 w-full" onClick={reset}>Forgot password</Button>
      {msg && <p className="text-sm text-muted-foreground" role="status">{msg}</p>}
    </form>
  );
}

function SetPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await (await getAdminSupabase()).auth.updateUser({ password: pw });
    if (error) return setMsg(error.message);
    onDone();
  };
  return (
    <form onSubmit={submit} className="mx-auto mt-16 max-w-sm space-y-4 rounded-[28px] border border-border bg-card p-7 shadow-sm">
      <h1 className="xt-display text-4xl leading-none">Set a new password</h1>
      <Input type="password" minLength={10} className="text-base" value={pw} onChange={(e) => setPw(e.target.value)} required />
      <Button type="submit" className="min-h-12 w-full">Save password</Button>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </form>
  );
}
