import { createHash, randomBytes } from 'node:crypto';
import { requiredDocumentKeys, validateCheckInDetails, type CheckInDetails } from './checkInModel';

export const CHECK_IN_BUCKET = 'guest-identity-documents';
export const CHECK_INS_PER_HOUR = 5;
export type IdentityDocumentKind = string;
export const DOCUMENT_KEY = /^(front|back|visa|selfie|g\d{1,2}-(front|back|single))$/;
type Db = any;
type Files = Record<string, File | null>;
type GuestDocument = { index: number; name: string; mode: 'separate' | 'single'; front?: string; back?: string; single?: string };

export class CheckInError extends Error {}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const checkInVisitorHash = (ip: string | undefined, day: string, salt: string | undefined) => hash(`${ip ?? 'unknown'}|${day}|${salt ?? 'xtsy-check-in'}`).slice(0, 32);
export const checkInTokenHash = (token: string) => hash(token);

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
export async function identityFileProblem(file: File | null, required = true, imageOnly = false): Promise<string | null> {
  if (!file) return required ? 'A required identity document is missing.' : null;
  if (file.size <= 0 || file.size > 8 * 1024 * 1024) return 'Each document must be 8 MB or smaller.';
  const ext = EXT[file.type];
  if (!ext) return 'Use a JPG, PNG, WebP or PDF document.';
  if (imageOnly && file.type === 'application/pdf') return 'The selfie must be a photo.';
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = new TextDecoder().decode(bytes);
  const valid = file.type === 'application/pdf' ? ascii.startsWith('%PDF-')
    : file.type === 'image/png' ? bytes.length >= 8 && bytes[0] === 0x89 && ascii.slice(1, 4) === 'PNG'
      : file.type === 'image/jpeg' ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : bytes.length >= 12 && ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP';
  return valid ? null : 'The file contents do not match its document type.';
}

export async function submitCheckIn(db: Db, input: unknown, files: Files, ip: string | undefined, now = new Date()): Promise<{ id: string; accessToken: string }> {
  if (!db) throw new CheckInError('Self check-in is temporarily unavailable. Please contact the front desk.');
  let details: CheckInDetails;
  try { details = validateCheckInDetails(input); } catch (e) { throw new CheckInError(e instanceof Error ? e.message : 'Check the details and try again.'); }
  const keys = requiredDocumentKeys(details);
  let totalBytes = 0;
  for (const key of keys) {
    const problem = await identityFileProblem(files[key] ?? null, true, key === 'selfie');
    if (problem) throw new CheckInError(`${documentLabel(key, details.isInternational)}: ${problem}`);
    totalBytes += files[key]?.size ?? 0;
  }
  if (totalBytes > 90 * 1024 * 1024) throw new CheckInError('The documents are too large together. Please use smaller photos.');
  const visitorHash = checkInVisitorHash(ip, now.toISOString().slice(0, 10), process.env['ENQUIRY_HASH_SALT']);
  const since = new Date(now.getTime() - 3600_000).toISOString();
  const recent = await db.from('be_self_check_ins').select('id', { count: 'exact', head: true }).eq('visitor_hash', visitorHash).gte('created_at', since);
  if (recent.error) throw new CheckInError('Could not verify the submission limit. Please try again.');
  if ((recent.count ?? 0) >= CHECK_INS_PER_HOUR) throw new CheckInError('Too many check-ins from this connection. Please wait an hour or contact the desk.');

  const accessToken = randomBytes(32).toString('base64url');
  const insert = await db.from('be_self_check_ins').insert({
    access_token_hash: checkInTokenHash(accessToken), property_id: details.propertyId,
    booking_reference: details.bookingReference?.toUpperCase() || null, guest_name: details.guestName,
    check_in_date: details.checkInDate, check_in_time: details.checkInTime,
    check_out_date: details.checkOutDate, check_out_time: details.checkOutTime, form_opened_at: details.formOpenedAt ?? null,
    emergency_contact_name: details.emergencyName, emergency_contact_phone: details.emergencyPhone, referral_source: details.referralSource, city: details.city, state: details.state,
    country: details.country, phone: details.phone, email: details.email, total_guests: details.totalGuests,
    purpose: details.purpose, is_international: details.isInternational, room_type_id: details.roomTypeId,
    policy_accepted_at: now.toISOString(), visitor_hash: visitorHash,
  }).select('id').single();
  if (insert.error || !insert.data?.id) throw new CheckInError('Could not save your check-in. Please try again.');
  const id = insert.data.id as string;
  const uploaded: string[] = [];
  try {
    const paths: Record<string, unknown> = {};
    const guests: GuestDocument[] = details.guests.map((g, i) => ({ index: i + 2, name: g.name, mode: g.docMode }));
    for (const key of keys) {
      const file = files[key];
      if (!file) continue;
      const path = `${id}/${key}.${EXT[file.type]}`;
      const result = await db.storage.from(CHECK_IN_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (result.error) throw new CheckInError('Could not securely store a document. Please try again.');
      uploaded.push(path);
      const g = /^g(\d+)-(front|back|single)$/.exec(key);
      if (g) { const entry = guests.find((x) => x.index === Number(g[1])); if (entry) entry[g[2] as 'front' | 'back' | 'single'] = path; }
      else paths[key === 'front' ? 'id_front_path' : key === 'back' ? 'id_back_path' : key === 'visa' ? 'visa_path' : 'selfie_path'] = path;
    }
    paths['guest_documents'] = guests;
    const update = await db.from('be_self_check_ins').update(paths).eq('id', id);
    if (update.error) throw new CheckInError('Could not finish your check-in. Please try again.');
  } catch (e) {
    if (uploaded.length) await db.storage.from(CHECK_IN_BUCKET).remove(uploaded).catch(() => undefined);
    await db.from('be_self_check_ins').delete().eq('id', id);
    throw e;
  }
  return { id, accessToken };
}

export function documentLabel(key: string, international: boolean): string {
  if (key === 'selfie') return 'Main guest selfie';
  if (key === 'visa') return 'Visa';
  const doc = international ? 'Passport' : 'National ID';
  if (key === 'front') return `Main guest · ${doc} ${international ? 'first page' : 'front'}`;
  if (key === 'back') return `Main guest · ${doc} ${international ? 'last page' : 'back'}`;
  const g = /^g(\d+)-(front|back|single)$/.exec(key);
  return g ? `Guest ${g[1]} · ID ${g[2] === 'single' ? 'document' : g[2]}` : key;
}

/** Every stored document on a check-in row, keyed by its upload slot. */
export function documentPaths(row: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (row.selfie_path) out['selfie'] = row.selfie_path;
  if (row.id_front_path) out['front'] = row.id_front_path;
  if (row.id_back_path) out['back'] = row.id_back_path;
  if (row.visa_path) out['visa'] = row.visa_path;
  for (const g of (Array.isArray(row.guest_documents) ? row.guest_documents : []) as GuestDocument[]) {
    for (const side of ['front', 'back', 'single'] as const) if (g[side]) out[`g${g.index}-${side}`] = g[side]!;
  }
  return out;
}

function rowToStaff(row: any) {
  return {
    id: row.id, propertyId: row.property_id, bookingReference: row.booking_reference ?? '', guestName: row.guest_name,
    checkInDate: row.check_in_date, checkInTime: String(row.check_in_time).slice(0, 5), city: row.city, state: row.state,
    country: row.country, phone: row.phone, email: row.email, totalGuests: Number(row.total_guests), purpose: row.purpose,
    isInternational: !!row.is_international, roomTypeId: row.room_type_id, status: row.status, createdAt: row.created_at,
    checkOutDate: row.check_out_date ?? '', allocatedRoomTypeId: row.allocated_room_type_id ?? '', allocatedUnits: (row.allocated_units ?? []) as string[], allocationOverrideId: row.allocation_override_id ?? '', allocatedAt: row.allocated_at ?? '',
    documents: { front: !!row.id_front_path, back: !!row.id_back_path, visa: !!row.visa_path },
    documentList: Object.keys(documentPaths(row)).map((key) => ({ key, label: documentLabel(key, !!row.is_international) })),
    checkOutTime: row.check_out_time ? String(row.check_out_time).slice(0, 5) : '',
    formOpenedAt: row.form_opened_at ?? '', emergencyName: row.emergency_contact_name ?? '', emergencyPhone: row.emergency_contact_phone ?? '',
    referralSource: row.referral_source ?? '',
    guestNames: ((Array.isArray(row.guest_documents) ? row.guest_documents : []) as GuestDocument[]).map((g) => g.name),
  };
}

export async function listCheckIns(db: Db) {
  const r = await db.from('be_self_check_ins').select('*').order('created_at', { ascending: false }).limit(300);
  if (r.error) throw new CheckInError('Could not load self check-ins.');
  return (r.data ?? []).map(rowToStaff);
}

async function signedDocument(db: Db, row: any, kind: IdentityDocumentKind, mode: 'view' | 'download') {
  const path = documentPaths(row)[kind];
  if (!path) throw new CheckInError('That document was not submitted.');
  const options = mode === 'download' ? { download: `${kind}-document` } : {};
  const r = await db.storage.from(CHECK_IN_BUCKET).createSignedUrl(path, 300, options);
  if (r.error || !r.data?.signedUrl) throw new CheckInError('Could not prepare the private document link.');
  return { url: r.data.signedUrl as string, expiresInSeconds: 300 };
}

export async function staffCheckInDocument(db: Db, id: string, kind: IdentityDocumentKind, mode: 'view' | 'download') {
  const r = await db.from('be_self_check_ins').select('id,id_front_path,id_back_path,visa_path,selfie_path,guest_documents').eq('id', id).maybeSingle();
  if (r.error || !r.data) throw new CheckInError('Check-in not found.');
  return signedDocument(db, r.data, kind, mode);
}

export async function guestCheckIn(db: Db, id: string, token: string) {
  if (!db) throw new CheckInError('Your private documents are temporarily unavailable.');
  const r = await db.from('be_self_check_ins').select('*').eq('id', id).eq('access_token_hash', checkInTokenHash(token)).maybeSingle();
  if (r.error || !r.data) throw new CheckInError('This private check-in link is not valid.');
  const documents: Partial<Record<IdentityDocumentKind, { viewUrl: string; downloadUrl: string }>> = {};
  for (const [kind, path] of Object.entries(documentPaths(r.data))) {
    const view = await db.storage.from(CHECK_IN_BUCKET).createSignedUrl(path, 300);
    const download = await db.storage.from(CHECK_IN_BUCKET).createSignedUrl(path, 300, { download: `${kind}-document` });
    if (!view.error && !download.error && view.data?.signedUrl && download.data?.signedUrl) documents[kind] = { viewUrl: view.data.signedUrl, downloadUrl: download.data.signedUrl };
  }
  return { checkIn: rowToStaff(r.data), documents };
}
