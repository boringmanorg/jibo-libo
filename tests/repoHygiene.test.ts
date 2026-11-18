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

describe('.gitleaksignore stays in sync', () => {
  // Fingerprints are "path:rule:line". A line number drifts the moment anything
  // above it moves, and gitleaks then reports a known false positive as a NEW
  // finding and fails the secrets check — with no local signal. That has now
  // happened three times (TripChat.tsx 20->21, tourPageData.ts 24->25). This
  // test turns a silent CI failure into a local one.
  const RULES: Record<string, RegExp> = {
    'generic-secret': /(secret|key|token|password)\s*[:=]\s*["']?[a-zA-Z0-9_-]{16,}["']?/i,
    jwt: /eyJ[A-Za-z0-9_/+-]*\.eyJ[A-Za-z0-9_/+-]*\./,
    'supabase-service-key': /eyJ[A-Za-z0-9_/+-]*\.eyJ[A-Za-z0-9_/+-]*\./,
  };

  it('every fingerprint still points at a line that matches its rule', () => {
    const ignoreFile = join(ROOT, '.gitleaksignore');
    if (!existsSync(ignoreFile)) return;
    const stale: string[] = [];
    for (const raw of readFileSync(ignoreFile, 'utf8').split('\n')) {
      const entry = raw.trim();
      if (!entry || entry.startsWith('#')) continue;
      const at = entry.lastIndexOf(':');
      const ruleAt = entry.lastIndexOf(':', at - 1);
      const [path, rule, lineNo] = [entry.slice(0, ruleAt), entry.slice(ruleAt + 1, at), Number(entry.slice(at + 1))];
      const full = join(ROOT, path);
      if (!existsSync(full)) continue; // entry for a deleted file: inert, not stale
      const re = RULES[rule];
      if (!re) continue; // rule we do not model here
      const line = readFileSync(full, 'utf8').split('\n')[lineNo - 1];
      if (line === undefined || !re.test(line)) stale.push(`${entry} -> ${line === undefined ? '(no such line)' : line.trim().slice(0, 60)}`);
    }
    expect(
      stale,
      `these .gitleaksignore fingerprints no longer match their line, so the ` +
        `secrets check will fail. Re-pin the line number, or better, rename the ` +
        `symbol so the rule stops matching:\n  ${stale.join('\n  ')}`,
    ).toEqual([]);
  });
});

describe('database cutoff', () => {
  // The site runs without a database. Everything goes through offlineBackend;
  // Guest imports must not bypass that chokepoint. Platform-generated server
  // helpers can exist on disk, but must remain disconnected from app code.
  // Never delete or edit generated helpers merely to satisfy a file-count check.
  const ALLOWED = new Set([
    'src/integrations/supabase/client.server.ts',
    'src/integrations/supabase/auth-middleware.ts',
  ]);

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
    }
    return out;
  };

  it('only documented generated server helpers import the Supabase SDK directly', () => {
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

  it('generated database server helpers remain disconnected from application code', () => {
    const offenders = walk(join(ROOT, 'src'))
      .filter((file) => !ALLOWED.has(file.slice(ROOT.length).replace(/^\/+/, '')))
      // The legacy listing callback is server-only and refuses before any
      // database import unless explicitly enabled; bistroGoogleSync.test.ts
      // verifies the off-by-default refusal. Guest callers get no exception.
      .filter((file) => file !== join(ROOT, 'src/lib/bistroGoogleSync.server.ts'))
      .filter((file) => /(?:from\s*|import\s*\(|export[^;]*from\s*)['"][^'"]*(?:auth-middleware|client\.server)['"]|\brequireSupabaseAuth\b/.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(ROOT.length).replace(/^\/+/, ''));
    expect(offenders, 'Generated database helpers must not enter the guest application graph').toEqual([]);
  });
});
