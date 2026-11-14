import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const tracked = (p: string) => {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', p], { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

describe('repository hygiene', () => {
  // .env was committed once and .gitignore alone does not untrack a file that
  // is already in the index. .env.example warns that SUPABASE_SERVICE_ROLE_KEY
  // must never be committed — if .env is tracked, the day that key is added it
  // ships to the repo.
  it('does not track .env', () => {
    expect(tracked('.env'), '.env is tracked — run: git rm --cached .env').toBe(false);
  });

  it('still tracks .env.example, which documents the shape', () => {
    expect(tracked('.env.example')).toBe(true);
  });
});

describe('database cutoff', () => {
  // The site runs without a database. Everything goes through offlineBackend;
  // importing the SDK directly bypasses that chokepoint, and wiring such a file
  // up would restore both the bundle weight and live Supabase calls.
  // auth-middleware.ts has been deleted twice and reintroduced twice, so this
  // is a test rather than another manual removal.
  const ALLOWED = new Set(['src/integrations/supabase/client.server.ts']);

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
    }
    return out;
  };

  it('only the documented server-side file imports the Supabase SDK directly', () => {
    const offenders = walk(join(ROOT, 'src'))
      .filter((f) => /from ['"]@supabase\/supabase-js['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(ROOT.length).replace(/^\/+/, ''))
      .filter((rel) => !ALLOWED.has(rel));
    expect(
      offenders,
      `these bypass offlineBackend: ${offenders.join(', ')}. Route them through ` +
        `src/integrations/supabase/client.ts, or add to ALLOWED with a reason.`,
    ).toEqual([]);
  });

  it('the reintroduced auth middleware stays deleted', () => {
    expect(existsSync(join(ROOT, 'src/integrations/supabase/auth-middleware.ts'))).toBe(false);
  });
});
