/** Keep descriptions readable without inventing destination or offer facts. */
export function describePage(summary: string, detail: string): string {
  const clean = summary.replace(/\s+/g, ' ').trim();
  const text = clean.length < 110 ? `${clean.replace(/[.!?]$/, '')}. ${detail}` : clean;
  return text.length <= 158 ? text : text.slice(0, 159).replace(/\s+\S*$/, '').replace(/[ ,;:—–-]+$/, '');
}

/** Only real HTTP images belong in structured data, never placeholder files. */
export function schemaImage(src: string): string | undefined {
  if (!src || /placeholder\.(svg|png)/i.test(src)) return undefined;
  if (/^https:\/\//.test(src)) return src;
  if (src.startsWith('/') && !src.startsWith('//')) return `https://xtsy.one${src}`;
  return undefined;
}