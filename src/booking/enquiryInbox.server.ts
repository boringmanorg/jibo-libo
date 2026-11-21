/**
 * Saves a guest's /book or camp enquiry for the console inbox. Called fire-and-forget after
 * WhatsApp opens, so a slow or paused database never holds the guest. Server only.
 */
import { createHash } from 'node:crypto';

export interface EnquiryInput {
  reference: string;
  kind: 'stay' | 'camp';
  name: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  summary: string;
  estimate: number;
}

/** At most this many enquiries per visitor per hour reach the inbox (stops a script filling it). */
export const ENQUIRIES_PER_HOUR = 12;

export const visitorHash = (ip: string | undefined, day: string) =>
  createHash('sha256').update(`${ip ?? 'unknown'}|${day}|${process.env['ENQUIRY_HASH_SALT'] ?? 'xtsy-inbox'}`).digest('hex').slice(0, 32);

export async function recordEnquiry(db: any, input: EnquiryInput, ip: string | undefined, now = new Date()): Promise<{ saved: boolean; reason?: string }> {
  if (!db) return { saved: false, reason: 'no-db' };
  const hash = visitorHash(ip, now.toISOString().slice(0, 10));
  const since = new Date(now.getTime() - 3600_000).toISOString();
  const recent = await db.from('be_enquiries').select('id', { count: 'exact', head: true }).eq('visitor_hash', hash).gte('created_at', since);
  if (recent.error) return { saved: false, reason: 'db' };
  if ((recent.count ?? 0) >= ENQUIRIES_PER_HOUR) return { saved: false, reason: 'rate-limited' };
  const { error } = await db.from('be_enquiries').insert({
    reference: input.reference, kind: input.kind, guest_name: input.name, guest_phone: input.phone,
    check_in: input.checkIn, check_out: input.checkOut, guests: input.guests, summary: input.summary,
    estimate_rupees: Math.round(input.estimate), visitor_hash: hash,
  });
  return error ? { saved: false, reason: 'db' } : { saved: true };
}
