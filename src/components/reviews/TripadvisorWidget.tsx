/**
 * Tripadvisor "Review Snippets" for XTSY Travellers Hostel (hostel only).
 * Tripadvisor's script loads only below the fold and only with marketing
 * consent, or when the guest taps to show it.
 */
import { useEffect, useRef, useState } from 'react';
import { readConsent } from '@/lib/consent';

const SRC = 'https://www.jscache.com/wejs?wtype=selfserveprop&uniq=583&locationId=33032214&lang=en_US&rating=true&nreviews=5&writereviewlink=true&popIdx=true&iswide=false&border=true&display_version=2';
const LISTING = 'https://www.tripadvisor.in/Hotel_Review-d33032214';

export function TripadvisorWidget() {
  const box = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    if (!readConsent()?.marketing || !box.current) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) { setLoad(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!load || !box.current) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = SRC;
    box.current.appendChild(s);
  }, [load]);

  return (
    <div ref={box} className="w-[240px] min-h-[120px] rounded-xl bg-card p-2 text-card-foreground">
      <div id="TA_selfserveprop583" className="TA_selfserveprop">
        <ul id="NUVxCWqcQ" className="TA_links m-0 list-none p-0">
          <li><a target="_blank" rel="noopener noreferrer" href={LISTING} className="text-sm font-semibold underline">XTSY Travellers Hostel on Tripadvisor</a></li>
        </ul>
      </div>
      {!load && (
        <button type="button" onClick={() => setLoad(true)} className="mt-2 min-h-12 w-full rounded-lg border border-border text-sm font-semibold">
          Show Tripadvisor reviews
        </button>
      )}
    </div>
  );
}
