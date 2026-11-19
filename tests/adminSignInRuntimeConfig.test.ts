import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readAdminAuthConfig } from '../src/admin/adminAuthConfig.functions';
import {
  generateProductionSecurityHeaders,
  isAdminPath,
  withAdminConnectSources,
} from '../src/utils/productionSecurityHeaders';

describe('admin sign-in config comes from the server at runtime', () => {
  it('returns the project URL and publishable key', () => {
    expect(readAdminAuthConfig({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'pk' })).toEqual({
      url: 'https://p.supabase.co',
      publishableKey: 'pk',
    });
  });
  it('names what is missing instead of failing with "supabaseUrl is required"', () => {
    const r = readAdminAuthConfig({});
    expect('error' in r && r.error).toMatch(/SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY/);
  });
  it('never returns the service role key', () => {
    const r = readAdminAuthConfig({ SUPABASE_URL: 'u', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SERVICE_ROLE_KEY: 'sr' });
    expect(JSON.stringify(r)).not.toContain('sr"');
  });
  it('the browser client no longer depends on build-time env only', () => {
    const src = readFileSync('src/admin/adminSupabase.ts', 'utf8');
    expect(src).toMatch(/getAdminAuthConfig\(\)/);
  });
});

describe('Content Security Policy for the admin console', () => {
  const csp = generateProductionSecurityHeaders({ isDevelopment: false })['Content-Security-Policy'];
  it('guest pages do not allow Supabase', () => {
    expect(csp).not.toMatch(/supabase\.co/);
  });
  it('admin pages allow Supabase in connect-src only', () => {
    const admin = withAdminConnectSources(csp);
    expect(admin).toMatch(/connect-src [^;]*https:\/\/\*\.supabase\.co/);
    expect(admin).toMatch(/connect-src [^;]*wss:\/\/\*\.supabase\.co/);
    expect(admin.replace(/connect-src [^;]*/, '')).not.toMatch(/supabase/);
    expect(withAdminConnectSources(admin)).toBe(admin);
  });
  it('recognises admin paths', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/bookings')).toBe(true);
    expect(isAdminPath('/administrator-guide')).toBe(false);
    expect(isAdminPath('/')).toBe(false);
  });
});
