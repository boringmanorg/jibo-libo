import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAdminSupabase, SUPER_ADMIN_EMAIL } from '@/admin/adminSupabase';
import { deniedMessage, deniedReason, signInErrorMessage, type DeniedReason } from '@/admin/signInMessages';

export const Route = createFileRoute('/(admin)/admin')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'XTSY Super Admin Console' },
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

  useEffect(() => {
    const sb = getAdminSupabase();
    const evaluate = async () => {
      const { data } = await sb.auth.getUser();
      const u = data.user;
      if (!u) return setStatus('out');
      setEmail(u.email ?? '');
      const why = deniedReason(u, SUPER_ADMIN_EMAIL);
      setReason(why);
      if (why !== 'no_admin_role') return setStatus('denied');
      const { data: ok } = await sb.rpc('is_super_admin');
      setStatus(ok === true ? 'in' : 'denied');
    };
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') return setStatus('recovery');
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void evaluate();
    });
    void evaluate();
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => { await getAdminSupabase().auth.signOut(); setStatus('out'); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {status === 'loading' && <p className="p-10 text-center text-muted-foreground">Checking access…</p>}
      {status === 'out' && <SignIn />}
      {status === 'recovery' && <SetPassword onDone={() => setStatus('loading')} />}
      {status === 'denied' && (
        <div className="mx-auto max-w-md p-10 text-center">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-muted-foreground">{deniedMessage(reason, email)}</p>
          <Button className="mt-6 min-h-12" onClick={signOut}>Sign out</Button>
        </div>
      )}
      {status === 'in' && (
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">XTSY</p>
              <h1 className="text-2xl font-semibold">Super admin console</h1>
            </div>
            <nav className="flex flex-wrap gap-2">
              {[['/admin', 'Overview'], ['/admin/bookings', 'Bookings'], ['/admin/booking-engine', 'Booking engine'], ['/admin/staah', 'STAAH'], ['/admin/night-audit', 'Night audit'], ['/admin/stays', 'Stays'], ['/admin/restaurants', 'Restaurants'], ['/admin/settings', 'Integrations']].map(([to, label]) => (
                <Link key={to} to={to} activeOptions={{ exact: true }} className="inline-flex min-h-12 items-center rounded-md px-4 text-sm hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground">{label}</Link>
              ))}
              <Button variant="outline" className="min-h-12" onClick={signOut}>Sign out</Button>
            </nav>
          </header>
          <Outlet />
        </div>
      )}
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState(SUPER_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    const { error } = await getAdminSupabase().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMsg(signInErrorMessage(error));
  };
  const reset = async () => {
    const { error } = await getAdminSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin` });
    setMsg(error ? 'Could not send reset email.' : 'Password reset email sent.');
  };
  return (
    <form onSubmit={submit} className="mx-auto mt-16 max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Super admin sign-in</h1>
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
    const { error } = await getAdminSupabase().auth.updateUser({ password: pw });
    if (error) return setMsg(error.message);
    onDone();
  };
  return (
    <form onSubmit={submit} className="mx-auto mt-16 max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Set a new password</h1>
      <Input type="password" minLength={10} className="text-base" value={pw} onChange={(e) => setPw(e.target.value)} required />
      <Button type="submit" className="min-h-12 w-full">Save password</Button>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </form>
  );
}
