/**
 * Real, credited photographs for the rental fleet, tours, destinations and page heroes (CI only;
 * the image hosts are not reachable from the build sandbox).
 *
 * Runs in CI through the reviewed-photo workflow on main (.github/workflows/pexels-photos.yml):
 *   candidates with only_keys "site" (or "site:key1,key2"); apply runs whenever site-picks.json has picks.
 *
 *   MODE=candidates  search Wikimedia Commons (free licences only) and Pexels for every target in
 *                    siteTargets.ts, write scripts/images/site-candidates.json and numbered contact
 *                    sheets to shots/site/ for review. ONLY_KEYS=a,b limits and merges.
 *   MODE=apply       download the reviewed picks (scripts/images/site-picks.json, { key: number }),
 *                    write WebP + AVIF to public/img/sp/ and merge credits into src/data/sitePhotos.ts.
 */
import fs from 'fs';
import sharp from 'sharp';
import { SITE_TARGETS } from './siteTargets';

const UA = 'xtsy.one site photos (https://xtsy.one; ci@xtsy.one)';
const CANDS = 'scripts/images/site-candidates.json';
const PICKS = 'scripts/images/site-picks.json';
const DATA = 'src/data/sitePhotos.ts';
const PER = 8;
const FREE = /^(cc0|cc[ -]by(-sa)?[ -]?\d|public domain|pd\b|pd-|attribution)/i;

type Cand = { n: number; source: 'commons' | 'pexels'; title: string; page: string; by: string; byUrl?: string; license: string; licenseUrl?: string; full: string; thumb: string; w: number; h: number };

const strip = (html: string) => (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));

async function commons(q: string): Promise<Cand[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=25&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600`;
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) { console.log(`::warning::Commons ${r.status} for "${q}"`); return []; }
  const pages = Object.values(((await r.json()) as any).query?.pages ?? {}) as any[];
  return pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).flatMap((p) => {
    const ii = p.imageinfo?.[0];
    const m = ii?.extmetadata ?? {};
    const license = strip(m.LicenseShortName?.value ?? '');
    if (!ii || !/image\/(jpeg|png|webp)/.test(ii.mime) || ii.width < 1000 || !FREE.test(license) || /\bnc\b|\bnd\b/i.test(license)) return [];
    const desc = strip(m.ImageDescription?.value ?? '').slice(0, 200);
    return [{ n: 0, source: 'commons' as const, title: `${p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '')} ${desc}`.trim(), page: ii.descriptionurl, by: strip(m.Artist?.value ?? 'Unknown').slice(0, 80) || 'Unknown', license, licenseUrl: m.LicenseUrl?.value, full: ii.thumburl ?? ii.url, thumb: ii.thumburl ?? ii.url, w: ii.width, h: ii.height }];
  });
}

async function pexels(q: string): Promise<Cand[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=landscape&per_page=15`, { headers: { Authorization: key } });
  if (!r.ok) { console.log(`::warning::Pexels ${r.status} for "${q}"`); return []; }
  return (((await r.json()) as any).photos ?? []).filter((p: any) => p.width >= 1200).map((p: any) => ({
    n: 0, source: 'pexels' as const, title: `${p.alt ?? ''} ${String(p.url).replace(/-/g, ' ')}`, page: p.url, by: p.photographer, byUrl: p.photographer_url,
    license: 'Pexels licence', licenseUrl: 'https://www.pexels.com/license/', full: `${p.src.original}?auto=compress&cs=tinysrgb&w=1600`, thumb: p.src.medium, w: p.width, h: p.height,
  }));
}

async function candidates() {
  fs.mkdirSync('shots/site', { recursive: true });
  const only = (process.env.ONLY_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean);
  const targets = only.length ? SITE_TARGETS.filter((t) => only.includes(t.key)) : SITE_TARGETS;
  const all: Record<string, Cand[]> = only.length && fs.existsSync(CANDS) ? JSON.parse(fs.readFileSync(CANDS, 'utf8')) : {};
  for (const tg of targets) {
    const list: Cand[] = [];
    const seen = new Set<string>();
    const add = (c: Cand) => { if (list.length < PER && !seen.has(c.page) && (!tg.match || tg.match.test(c.title))) { seen.add(c.page); list.push({ ...c, n: list.length + 1 }); } };
    for (const q of tg.commons) { if (list.length >= 6) break; (await commons(q)).forEach(add); }
    for (const q of tg.pexels ?? []) { if (list.length >= PER) break; (await pexels(q)).forEach(add); }
    all[tg.key] = list;
    console.log(`${tg.key}: ${list.length} (${list.map((c) => c.source[0]).join('')})`);
  }
  fs.writeFileSync(CANDS, JSON.stringify(all, null, 1));

  const TW = 260, TH = 174, LABEL = 230, ROWS = 7;
  const keys = targets.map((t) => t.key);
  for (let s = 0; s * ROWS < keys.length; s++) {
    const rows = keys.slice(s * ROWS, s * ROWS + ROWS);
    const W = LABEL + PER * (TW + 6), H = rows.length * (TH + 8);
    const layers: sharp.OverlayOptions[] = [];
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
    for (const [ri, key] of rows.entries()) {
      const y = ri * (TH + 8);
      const tg = SITE_TARGETS.find((t) => t.key === key)!;
      svg += `<text x="8" y="${y + 24}" font-family="sans-serif" font-size="15" font-weight="700">${esc(key)}</text><text x="8" y="${y + 46}" font-family="sans-serif" font-size="13">${esc(tg.label.slice(0, 30))}</text>`;
      if (!all[key].length) svg += `<text x="8" y="${y + 70}" font-family="sans-serif" font-size="13" fill="#b3262f">nothing found</text>`;
      for (const c of all[key]) {
        try {
          const res = await fetch(c.thumb.replace(/\/1600px-/, '/400px-'), { headers: { 'user-agent': UA } });
          const img = await sharp(Buffer.from(await res.arrayBuffer())).resize(TW, TH, { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer();
          const x = LABEL + (c.n - 1) * (TW + 6);
          layers.push({ input: img, left: x, top: y });
          svg += `<rect x="${x}" y="${y}" width="44" height="24" fill="#000" opacity="0.75"/><text x="${x + 6}" y="${y + 18}" font-family="sans-serif" font-size="16" font-weight="700" fill="#fff">${c.n}${c.source[0]}</text>`;
          svg += `<rect x="${x}" y="${y + TH - 20}" width="${TW}" height="20" fill="#000" opacity="0.6"/><text x="${x + 4}" y="${y + TH - 6}" font-family="sans-serif" font-size="10" fill="#fff">${esc(c.title.slice(0, 50))}</text>`;
        } catch { /* skip thumbnail */ }
      }
    }
    svg += '</svg>';
    await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
      .composite([...layers, { input: Buffer.from(svg), left: 0, top: 0 }])
      .jpeg({ quality: 78 })
      .toFile(`shots/site/sheet-${String(s + 1).padStart(2, '0')}.jpg`);
  }
}

async function apply() {
  const cands: Record<string, Cand[]> = JSON.parse(fs.readFileSync(CANDS, 'utf8'));
  const picks: Record<string, number> = JSON.parse(fs.readFileSync(PICKS, 'utf8'));
  const existing = fs.existsSync(DATA) ? JSON.parse(/= (\{[\s\S]*\});\s*$/.exec(fs.readFileSync(DATA, 'utf8'))?.[1] ?? '{}') : {};
  fs.mkdirSync('public/img/sp', { recursive: true });
  for (const [key, n] of Object.entries(picks)) {
    const c = cands[key]?.find((x) => x.n === n);
    if (!c) { console.log(`::warning::${key}: candidate ${n} not found`); continue; }
    if (existing[key]?.page === c.page) continue;
    const res = await fetch(c.full, { headers: { 'user-agent': UA } });
    if (!res.ok) { console.log(`::error::${key}: download ${res.status}`); process.exitCode = 1; continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).rotate().metadata();
    const srcs: [number, string][] = [];
    for (const w of [480, 640, 828, 1280]) {
      const file = `public/img/sp/${key}-${w}.webp`;
      await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 74 }).toFile(file);
      await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).avif({ quality: 50, effort: 4 }).toFile(file.replace(/\.webp$/, '.avif'));
      srcs.push([w, `/img/sp/${key}-${w}.webp`]);
    }
    const ratio = (meta.height ?? 1) / (meta.width ?? 1);
    const label = SITE_TARGETS.find((t) => t.key === key)?.label ?? key;
    existing[key] = { w: 1280, h: Math.round(1280 * ratio), srcs, alt: label, by: c.by, byUrl: c.byUrl, source: c.source, page: c.page, license: c.license, licenseUrl: c.licenseUrl };
    console.log(key, c.source, c.by, c.license);
  }
  fs.writeFileSync(DATA, `// AUTO-GENERATED by scripts/images/site-photos.ts (MODE=apply) — reviewed, credited photographs
// from Wikimedia Commons (free licences) and Pexels. Edit picks in scripts/images/site-picks.json.
export type SitePhoto = { w: number; h: number; srcs: [number, string][]; alt: string; by: string; byUrl?: string; source: 'commons' | 'pexels'; page: string; license: string; licenseUrl?: string };
export const SITE_PHOTOS: Record<string, SitePhoto> = ${JSON.stringify(existing, null, 1)};
`);
}

(process.env.MODE === 'apply' ? apply() : candidates()).catch((e) => { console.log(`::error::${e}`); process.exit(1); });
