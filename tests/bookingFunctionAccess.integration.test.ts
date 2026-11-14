import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Live permission regression checks: no writes, no personal data returned or logged.
//
// .env is deliberately not committed, so it is absent on CI and on any fresh
// clone. Reading it eagerly threw ENOENT at import time, before the skip logic
// below could run, failing the whole unit-test job. Missing credentials now
// mean the same thing as an unreachable backend: skip, don't fail.
function readEnvFile(): Record<string, string> {
  let raw: string;
  try {
    raw = readFileSync('.env', 'utf8');
  } catch {
    return {};
  }
  return Object.fromEntries(
    raw.split('\n').filter((line) => line.includes('=')).map((line) => {
      const position = line.indexOf('=');
      return [line.slice(0, position), line.slice(position + 1).replace(/^['"]|['"]$/g, '')];
    }),
  );
}
const config = readEnvFile();
const url = config.VITE_SUPABASE_URL;
const key = config.VITE_SUPABASE_PUBLISHABLE_KEY ?? config.VITE_SUPABASE_ANON_KEY;
const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const token = session ? JSON.parse(session).access_token as string : undefined;

// These checks need the live backend. When it can't be reached (for example, DNS fails on the CI
// runner), skip them instead of failing the whole unit-test job; they still run wherever it's reachable.
async function backendReachable() {
  if (!url || !key) return false;
  try {
    await fetch(`${url}/rest/v1/`, { headers: { apikey: key }, signal: AbortSignal.timeout(5000) });
    return true;
  } catch {
    return false;
  }
}
const reachable = await backendReachable();
if (!reachable) console.warn(`Skipping live booking permission checks: ${url ? `backend at ${url} is unreachable` : 'no .env credentials available'}.`);
const live = it.skipIf(!reachable);
const liveSignedIn = it.skipIf(!reachable || !token);

async function rpc(name: string, body: Record<string, unknown>, authenticated = false) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${authenticated ? token : key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

describe('booking function execution boundaries', () => {
  live('guests cannot retrieve password reset codes', async () => {
    const result = await rpc('generate_password_reset_otp', { p_email: 'ownership-check@example.invalid' });
    expect(result.status).toBe(401);
    expect(result.data.code).toBe('42501');
  });
  live('guests cannot approve bookings', async () => {
    const result = await rpc('approve_booking_and_block_inventory', { p_booking_id: '00000000-0000-0000-0000-000000000000', p_admin_id: '00000000-0000-0000-0000-000000000000' });
    expect(result.status).toBe(401);
    expect(result.data.code).toBe('42501');
  });
  live('booking validation runs instead of failing at auth schema access', async () => {
    const result = await rpc('create_booking_secure', { p_guest_name: '', p_email: 'ownership-check@example.invalid', p_whatsapp_number: '+919999999999', p_check_in: '2027-01-01', p_check_out: '2027-01-02', p_guests: 1, p_room_type: 'Dorm', p_room_type_id: null, p_quantity: 1, p_subtotal: 399, p_taxes: 0, p_total_amount: 399 });
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ success: false, error: 'Invalid guest name' });
  });
  liveSignedIn('signed-in role checks can access auth', async () => {
    const result = await rpc('get_user_role', {}, true);
    expect(result.status).toBe(200);
    expect(['admin', 'staff', 'user', 'guest']).toContain(result.data);
  });
  liveSignedIn('an admin action rejects a forged actor before touching a booking', async () => {
    const result = await rpc('approve_enquiry', { p_enquiry_uuid: '00000000-0000-0000-0000-000000000000', p_admin_id: '00000000-0000-0000-0000-000000000000' }, true);
    expect(result.status).toBe(403);
    expect(result.data.code).toBe('42501');
  });
});