import { createFileRoute, Link, Navigate, Outlet, useRouterState } from '@tanstack/react-router';
import { PageHead } from '@/admin/components/ConsoleBits';
import { Ban, CalendarDays, CreditCard, ExternalLink, ImageIcon, Inbox, LogOut, Menu, PlugZap, ReceiptText, ScanLine, Sun, UtensilsCrossed, Wallet, X } from 'lucide-react';
import xtsyLogo from '@/assets/xtsy-color-logo.webp';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAdminSupabase, SUPER_ADMIN_EMAIL } from '@/admin/adminSupabase';
import { ConsoleScopeContext, hostelConsolePath } from '@/admin/consoleScope';
import { deniedMessage, deniedReason, signInErrorMessage, type DeniedReason } from '@/admin/signInMessages';

export const Route = createFileRoute('/(admin)/admin')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'XTSY Console' },
      { name: 'description', content: 'Private console for XTSY booking engine, PMS and POS.' },
      { name: 'robots', content: 'noindex, nofollow' },
      { property: 'og:title', content: 'XTSY Super Admin Console' },
      { property: 'og:description', content: 'Private console for XTSY booking engine, PMS and POS.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: AdminLayout,
});

type Status = 'loading' | 'out' | 'denied' | 'in' | 'recovery';

function AdminLayout() {
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState<DeniedReason>('wrong_email');
  const [configError, setConfigError] = useState('');
  const [access, setAccess] = useState<'admin' | 'frontdesk'>('admin');

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
        const why = deniedReason(u, SUPER_ADMIN_EMAIL);
        setReason(why);
        if (why !== 'no_admin_role') return setStatus('denied');
        if (u.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
          const { data: ok } = await sb.rpc('is_super_admin');
          setAccess('admin');
          setStatus(ok === true ? 'in' : 'denied');
        } else {
          const { data: ok } = await sb.rpc('be_is_checkin_staff');
          setAccess('frontdesk');
          setStatus(ok === true ? 'in' : 'denied');
        }
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
      {status === 'in' && <Shell email={email} access={access} onSignOut={signOut} />}
    </div>
  );
}

const NAV: { group: string; items: { to: string; label: string; icon: typeof CalendarDays; exact?: boolean }[] }[] = [
  { group: 'Run the hostel', items: [
    { to: '/admin', label: 'Today', icon: Sun, exact: true },
    { to: '/admin/inventory', label: 'Inventory', icon: CalendarDays },
    { to: '/admin/inbox', label: 'Inbox', icon: Inbox },
    { to: '/admin/check-in', label: 'Self check-in', icon: ScanLine },
    { to: '/admin/stays', label: 'Blocks', icon: Ban },
  ] },
  { group: 'Set up', items: [
    { to: '/admin/room-photos', label: 'Room photos', icon: ImageIcon },
    { to: '/admin/booking-engine', label: 'Online booking', icon: CreditCard },
    { to: '/admin/settings', label: 'Connections', icon: PlugZap },
    { to: '/admin/restaurants', label: 'TAB Bistro', icon: UtensilsCrossed },
  ] },
  { group: 'Money', items: [
    { to: '/admin/bookings', label: 'Paid bookings', icon: Wallet },
    { to: '/admin/invoices', label: 'Invoices', icon: ReceiptText },
  ] },
];

/** Titles for the older screens that don't draw their own heading. */
const OLD_SCREEN_TITLES: Record<string, [string, string]> = {
  '/admin/stays': ['Blocks', 'Close or reopen beds, rooms and tents on /book for a range of dates.'],
  '/admin/room-photos': ['Room photos', 'The photos /book shows for each room.'],
  '/admin/booking-engine': ['Online booking', 'Card and UPI payment on /book, fees and GST.'],
  '/admin/bookings': ['Paid bookings', 'Bookings paid online through /book.'],
  '/admin/invoices': ['Invoices', 'Advance receipts and tax invoices.'],
  '/admin/restaurants': ['TAB Bistro', 'Table slots and the live tables shown on the Bistro page.'],
};

function Shell({ email, access, onSignOut }: { email: string; access: 'admin' | 'frontdesk'; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (st) => st.location.pathname.replace(/\/$/, '') });
  if (access === 'frontdesk' && !hostelConsolePath(path)) return <Navigate to="/admin/check-in" replace />;
  const oldTitle = OLD_SCREEN_TITLES[path];
  const groups = access === 'frontdesk'
    ? NAV.map((g) => ({ ...g, items: g.items.filter((i) => hostelConsolePath(i.to)) })).filter((g) => g.items.length)
    : NAV;
  const nav = (
    <nav aria-label="Console" className="space-y-6">
      {groups.map((g) => (
        <div key={g.group}>
          <p className="px-3 pb-1.5 text-xs font-semibold text-muted-foreground">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map(({ to, label, icon: Icon, exact }) => (
              <li key={to}>
                <Link to={to} activeOptions={{ exact: !!exact }} onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-xt-mute transition-colors hover:bg-xt-cream hover:text-xt-ink [&.active]:bg-xt-ink [&.active]:text-xt-sand">
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />{label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="border-t border-xt-line pt-4">
        <a href="/book" target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-xt-mute hover:bg-xt-cream hover:text-xt-ink">
          <ExternalLink className="h-[18px] w-[18px]" aria-hidden />Open /book
        </a>
      </div>
    </nav>
  );
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[256px_1fr]">
      <aside className="hidden border-r border-xt-line bg-white/70 px-4 py-6 lg:flex lg:flex-col print:hidden">
        <Brand />
        <div className="mt-8 flex-1">{nav}</div>
        <Account email={email} onSignOut={onSignOut} />
      </aside>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-xt-line bg-xt-sand/95 px-4 backdrop-blur lg:hidden print:hidden">
        <Brand />
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="console-nav"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-xt-line bg-white" aria-label={open ? 'Close menu' : 'Open menu'}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {open && (
        <div id="console-nav" className="fixed inset-x-0 top-16 z-30 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-xt-line bg-xt-sand px-4 py-5 shadow-lg lg:hidden">
          {nav}
          <div className="mt-4"><Account email={email} onSignOut={onSignOut} /></div>
        </div>
      )}
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">
          {oldTitle && <PageHead title={oldTitle[0]} sub={oldTitle[1]} />}
          <ConsoleScopeContext.Provider value={access === 'admin' ? 'super' : 'hostel'}><Outlet /></ConsoleScopeContext.Provider>
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/admin" className="flex items-center gap-2.5" aria-label="XTSY console home">
      <img src={xtsyLogo} alt="XTSY" width={120} height={28} className="h-7 w-auto" />
      <span className="rounded-full bg-xt-ink px-2.5 py-0.5 text-xs font-bold text-xt-sand">Console</span>
    </Link>
  );
}

function Account({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-xt-cream p-3">
      <p className="min-w-0 truncate text-sm text-xt-mute" title={email}>{email}</p>
      <button type="button" onClick={onSignOut} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-xt-ink hover:bg-white">
        <LogOut className="h-4 w-4" aria-hidden />Sign out
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
