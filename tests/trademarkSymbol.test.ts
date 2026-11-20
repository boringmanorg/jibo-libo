import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// XTSY trademark applications 8128622 (class 43), 8128623 (39) and 8128624 (35) were filed on
// 18 Nov 2026 and are not registered yet. Until the certificates issue, the site uses ™; showing ®
// or "registered trademark" for an unregistered mark is an offence (Trade Marks Act 1999, s.107).
describe('XTSY trademark marking', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(n)) files.push(p);
    }
  };
  walk('src');
  files.push('public/llms.txt', 'public/llms-full.txt');

  it('never shows ® or "registered trademark" while the applications are pending', () => {
    const hits = files.flatMap((f) =>
      readFileSync(f, 'utf8').split('\n').filter((l) => /®|&reg;|\\u00ae|registered trade ?mark/i.test(l)).map((l) => `${f}: ${l.trim().slice(0, 100)}`),
    );
    expect(hits).toEqual([]);
  });

  it('the footer credits XTSY Ventures Private Limited with the application numbers', () => {
    const footer = readFileSync('src/components/v2/SiteFooter.tsx', 'utf8');
    expect(footer).toMatch(/XTSY™ is a trademark of, and is owned and operated by, XTSY Ventures Private Limited \(trademark applications 8128622, 8128623 and 8128624/);
  });
});
