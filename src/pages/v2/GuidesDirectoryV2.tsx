/**
 * /guides — every live Shillong, Meghalaya and Northeast guide on one crawlable page,
 * grouped by topic. Linked from the footer so no guide is more than two clicks from home.
 */
import { Link } from '@/lib/router-compat';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { Search, X, ArrowUpRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// The directory arrives from the route loader (server function); no guide data is bundled.
const route = getRouteApi('/guides');
import { PageShell, PageHero, Breadcrumbs, PAD } from '@/components/v2/blocks';
import { IMG } from '@/data/v2Images';

const first = (v: string | string[]) => (Array.isArray(v) ? v[0] : v);
/** Topic card photos — XTSY's own property and destination photos only. */
const TOPIC_PHOTO: Record<string, string> = {
  'Travel guides': IMG.meghalaya, 'Food & dining': first(IMG.bistro), 'Themed trips': IMG.laitlum,
  Itineraries: IMG.nohkalikai, 'Seasonal guides': IMG.umiam, 'Group trips': IMG.groups,
  Hostels: first(IMG.mixedDorm) || IMG.home, Stays: IMG.home, 'Tour packages': IMG.dawki,
  Destinations: IMG.mawlynnong, Attractions: IMG.rootBridge, Activities: IMG.krangSuri,
  Glamping: first(IMG.suite) || IMG.terrace, Hotels: IMG.about, Homestays: IMG.terrace,
  Rentals: IMG.bumla, 'Road & bike trips': IMG.bumla, Transport: IMG.assam,
  Workation: IMG.workation, 'Weddings & events': IMG.wedding, Events: IMG.sevenSisters,
  'Corporate offsites': IMG.commonRoom, 'Stays near hospitals': IMG.contact,
  'Hostel comparison': IMG.commonRoom, 'Travel agency': IMG.sikkim, 'XTSY pages': IMG.home,
};

const idOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function GuidesDirectoryV2() {
  const groups = route.useLoaderData()?.groups ?? [];
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('');
  const total = groups.reduce((a, g) => a + g.pages.length, 0);
  const term = query.trim().toLocaleLowerCase();
  const shown = groups.filter((g) => !topic || g.label === topic).map((g) => ({ ...g, pages: g.pages.filter((p) => `${p.label} ${p.slug} ${p.description ?? ''}`.toLocaleLowerCase().includes(term)) })).filter((g) => g.pages.length);
  const count = shown.reduce((n, g) => n + g.pages.length, 0);
  return (
    <PageShell cta={{ title: 'Found your plan?', sub: 'Base yourself at XTSY in New Shillong Township.' }}>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'All guides' }]} />
      <PageHero
        size="md"
        eyebrow="Travel guides"
        title="Plan Shillong & Meghalaya."
        text={<p className="m-0">{total} pages · Shillong stays, Meghalaya travel, Northeast itineraries, TAB Bistro and XTSY services.</p>}
      />
      <section aria-label="Guide topics" className={`${PAD} bg-xt-paper py-8`}>
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((g) => (
            <li key={g.label}>
              <a href={`#${idOf(g.label)}`} onClick={() => setTopic('')} className="group relative block aspect-[4/3] overflow-hidden rounded-3xl bg-xt-sand">
                <img src={TOPIC_PHOTO[g.label] ?? IMG.meghalaya} alt={`${g.label} in Shillong and Meghalaya`} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-xt-ink/85 to-transparent p-5 text-xt-paper">
                  <span className="text-[20px] font-extrabold leading-tight">{g.label}</span>
                  <span className="rounded-full bg-xt-paper/90 px-3 py-1 text-[13px] font-extrabold text-xt-ink">{g.pages.length}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <div className={`${PAD} grid gap-4 border-y border-xt-line bg-xt-paper py-6 md:grid-cols-[1fr_240px]`}>
        <div className="relative">
          <Search aria-hidden className="absolute left-4 top-4 h-5 w-5 text-xt-mute" />
          <Input aria-label="Search pages" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages or URLs" className="h-12 border-xt-line bg-xt-paper pl-12 pr-12 text-[16px] text-xt-ink md:text-[16px]" />
          {query && <Button variant="ghost" size="icon" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-0 top-0 h-12 w-12 text-xt-mute"><X /></Button>}
        </div>
        <select aria-label="Filter by topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="h-12 w-full rounded-md border border-xt-line bg-xt-paper px-4 text-[16px] text-xt-ink">
          <option value="">All topics</option>
          {groups.map((g) => <option key={g.label} value={g.label}>{g.label} ({g.pages.length})</option>)}
        </select>
        <p role="status" className="m-0 text-[14px] font-semibold text-xt-mute md:col-span-2">{count} of {total} pages</p>
      </div>
      <nav aria-label="Guide topics" className={`${PAD} border-b border-xt-line bg-xt-paper py-3`}>
        <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0">
          {shown.map((g) => (
            <li key={g.label} className="shrink-0">
              <a href={`#${idOf(g.label)}`} className="inline-flex min-h-12 items-center border-b-2 border-transparent px-2 text-[14px] font-extrabold text-xt-ink hover:border-xt-crimson hover:text-xt-crimson">
                {g.label} <span className="ml-1.5 text-xt-mute">{g.pages.length}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className={`${PAD} flex flex-col gap-14 py-14`}>
        {shown.length === 0 && <p className="text-[17px] text-xt-mute">No pages match this search.</p>}
        {shown.map((g) => (
          <section key={g.label} id={idOf(g.label)} aria-labelledby={`h-${idOf(g.label)}`} className="scroll-mt-24">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-xt-line pb-3">
              <h2 id={`h-${idOf(g.label)}`} className="m-0 text-[26px] font-extrabold text-xt-ink sm:text-[32px]">{g.label}</h2>
              {g.hub && <Link to={g.hub} className="text-[15px] font-extrabold text-xt-crimson hover:underline">Start here →</Link>}
            </div>
            <ul className="m-0 grid list-none gap-x-8 gap-y-0 p-0 md:grid-cols-2">
              {g.pages.map((p) => (
                <li key={p.slug}>
                  <Link to={`/${p.slug}`} className="group flex min-h-12 items-start justify-between gap-4 border-b border-xt-line py-5 text-xt-ink hover:text-xt-crimson">
                    <span className="min-w-0">
                      <span className="block text-[16px] font-bold leading-relaxed">{p.label}</span>
                      <span className="mt-1 block break-all text-[13px] text-xt-mute">/{p.slug}</span>
                    </span>
                    <ArrowUpRight aria-hidden className="mt-1 h-4 w-4 shrink-0 text-xt-crimson" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
