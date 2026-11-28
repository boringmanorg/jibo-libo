import { createHash, randomBytes } from 'node:crypto';
import { validateCheckInDetails, type CheckInDetails } from './checkInModel';

export const CHECK_IN_BUCKET = 'guest-identity-documents';
export const CHECK_INS_PER_HOUR = 5;
export type IdentityDocumentKind = 'front' | 'back' | 'visa';
type Db = any;
type Files = Record<IdentityDocumentKind, File | null>;

export class CheckInError extends Error {}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const checkInVisitorHash = (ip: string | undefined, day: string, salt: string | undefined) => hash(`${ip ?? 'unknown'}|${day}|${salt ?? 'xtsy-check-in'}`).slice(0, 32);
export const checkInTokenHash = (token: string) => hash(token);

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
export async function identityFileProblem(file: File | null, required = true): Promise<string | null> {
  if (!file) return required ? 'A required identity document is missing.' : null;
  if (file.size <= 0 || file.size > 8 * 1024 * 1024) return 'Each document must be 8 MB or smaller.';
  const ext = EXT[file.type];
  if (!ext) return 'Use a JPG, PNG, WebP or PDF document.';
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
  for (const kind of ['front', 'back', 'visa'] as const) {
    const problem = await identityFileProblem(files[kind], kind !== 'visa' || details.isInternational);
    if (problem) throw new CheckInError(problem);
  }
  const visitorHash = checkInVisitorHash(ip, now.toISOString().slice(0, 10), process.env['ENQUIRY_HASH_SALT']);
  const since = new Date(now.getTime() - 3600_000).toISOString();
  const recent = await db.from('be_self_check_ins').select('id', { count: 'exact', head: true }).eq('visitor_hash', visitorHash).gte('created_at', since);
  if (recent.error) throw new CheckInError('Could not verify the submission limit. Please try again.');
  if ((recent.count ?? 0) >= CHECK_INS_PER_HOUR) throw new CheckInError('Too many check-ins from this connection. Please wait an hour or contact the desk.');

  const accessToken = randomBytes(32).toString('base64url');
  const insert = await db.from('be_self_check_ins').insert({
    access_token_hash: checkInTokenHash(accessToken), property_id: details.propertyId,
    booking_reference: details.bookingReference?.toUpperCase() || null, guest_name: details.guestName,
    check_in_date: details.checkInDate, check_in_time: details.checkInTime, city: details.city, state: details.state,
    country: details.country, phone: details.phone, email: details.email, total_guests: details.totalGuests,
    purpose: details.purpose, is_international: details.isInternational, room_type_id: details.roomTypeId,
    policy_accepted_at: now.toISOString(), visitor_hash: visitorHash,
  }).select('id').single();
  if (insert.error || !insert.data?.id) throw new CheckInError('Could not save your check-in. Please try again.');
  const id = insert.data.id as string;
  const uploaded: string[] = [];
  try {
    const paths: Record<string, string | null> = {};
    for (const kind of ['front', 'back', 'visa'] as const) {
      const file = files[kind];
      if (!file) continue;
      const path = `${id}/${kind}.${EXT[file.type]}`;
      const result = await db.storage.from(CHECK_IN_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (result.error) throw new CheckInError('Could not securely store a document. Please try again.');
      uploaded.push(path);
      paths[kind === 'front' ? 'id_front_path' : kind === 'back' ? 'id_back_path' : 'visa_path'] = path;
    }
    const update = await db.from('be_self_check_ins').update(paths).eq('id', id);
    if (update.error) throw new CheckInError('Could not finish your check-in. Please try again.');
  } catch (e) {
    if (uploaded.length) await db.storage.from(CHECK_IN_BUCKET).remove(uploaded).catch(() => undefined);
    await db.from('be_self_check_ins').delete().eq('id', id);
    throw e;
  }
  return { id, accessToken };
}

function rowToStaff(row: any) {
  return {
    id: row.id, propertyId: row.property_id, bookingReference: row.booking_reference ?? '', guestName: row.guest_name,
    checkInDate: row.check_in_date, checkInTime: String(row.check_in_time).slice(0, 5), city: row.city, state: row.state,
    country: row.country, phone: row.phone, email: row.email, totalGuests: Number(row.total_guests), purpose: row.purpose,
    isInternational: !!row.is_international, roomTypeId: row.room_type_id, status: row.status, createdAt: row.created_at,
    checkOutDate: row.check_out_date ?? '', allocatedRoomTypeId: row.allocated_room_type_id ?? '', allocatedUnits: (row.allocated_units ?? []) as string[], allocationOverrideId: row.allocation_override_id ?? '', allocatedAt: row.allocated_at ?? '',
    documents: { front: !!row.id_front_path, back: !!row.id_back_path, visa: !!row.visa_path },
  };
}

export async function listCheckIns(db: Db) {
  const r = await db.from('be_self_check_ins').select('*').order('created_at', { ascending: false }).limit(300);
  if (r.error) throw new CheckInError('Could not load self check-ins.');
  return (r.data ?? []).map(rowToStaff);
}

async function signedDocument(db: Db, row: any, kind: IdentityDocumentKind, mode: 'view' | 'download') {
  const path = row[kind === 'front' ? 'id_front_path' : kind === 'back' ? 'id_back_path' : 'visa_path'];
  if (!path) throw new CheckInError('That document was not submitted.');
  const options = mode === 'download' ? { download: `${kind}-identity-document` } : {};
  const r = await db.storage.from(CHECK_IN_BUCKET).createSignedUrl(path, 300, options);
  if (r.error || !r.data?.signedUrl) throw new CheckInError('Could not prepare the private document link.');
  return { url: r.data.signedUrl as string, expiresInSeconds: 300 };
}

export async function staffCheckInDocument(db: Db, id: string, kind: IdentityDocumentKind, mode: 'view' | 'download') {
  const r = await db.from('be_self_check_ins').select('id,id_front_path,id_back_path,visa_path').eq('id', id).maybeSingle();
  if (r.error || !r.data) throw new CheckInError('Check-in not found.');
  return signedDocument(db, r.data, kind, mode);
}

export async function guestCheckIn(db: Db, id: string, token: string) {
  if (!db) throw new CheckInError('Your private documents are temporarily unavailable.');
  const r = await db.from('be_self_check_ins').select('*').eq('id', id).eq('access_token_hash', checkInTokenHash(token)).maybeSingle();
  if (r.error || !r.data) throw new CheckInError('This private check-in link is not valid.');
  const documents: Partial<Record<IdentityDocumentKind, { viewUrl: string; downloadUrl: string }>> = {};
  for (const kind of ['front', 'back', 'visa'] as const) {
    const path = r.data[kind === 'front' ? 'id_front_path' : kind === 'back' ? 'id_back_path' : 'visa_path'];
    if (!path) continue;
    const view = await db.storage.from(CHECK_IN_BUCKET).createSignedUrl(path, 300);
    const download = await db.storage.from(CHECK_IN_BUCKET).createSignedUrl(path, 300, { download: `${kind}-identity-document` });
    if (!view.error && !download.error && view.data?.signedUrl && download.data?.signedUrl) documents[kind] = { viewUrl: view.data.signedUrl, downloadUrl: download.data.signedUrl };
  }
  return { checkIn: rowToStaff(r.data), documents };
}
