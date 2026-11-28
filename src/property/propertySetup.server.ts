import { getServiceClient } from '@/admin/serviceClient.server';
import type { GoogleReview, PlaceHit, PropertyProfile, PropertyType } from './propertySetup';

type Row = {
  property_id: string; property_type: string; display_name: string; description: string; address: string;
  latitude: number | null; longitude: number | null; google_place_id: string | null; google_maps_uri: string | null;
  google_rating: number | null; google_review_count: number | null; google_reviews: unknown; google_synced_at: string | null;
  amenities: string[]; ota_presence: string[]; hidden_room_types: string[];
};

function db() {
  const c = getServiceClient();
  if (!c) throw new Error('Database is not available.');
  return c;
}

function toProfile(r: Row): PropertyProfile {
  return {
    propertyId: r.property_id, propertyType: r.property_type as PropertyType, displayName: r.display_name, description: r.description,
    address: r.address, latitude: r.latitude, longitude: r.longitude, googlePlaceId: r.google_place_id, googleMapsUri: r.google_maps_uri,
    googleRating: r.google_rating === null ? null : Number(r.google_rating), googleReviewCount: r.google_review_count,
    googleReviews: Array.isArray(r.google_reviews) ? (r.google_reviews as GoogleReview[]) : [], googleSyncedAt: r.google_synced_at,
    amenities: r.amenities ?? [], otaPresence: r.ota_presence ?? [], hiddenRoomTypes: r.hidden_room_types ?? [],
  };
}

export async function readProfile(propertyId: string): Promise<PropertyProfile | null> {
  const { data, error } = await db().from('be_property_profiles').select('*').eq('property_id', propertyId).maybeSingle();
  if (error) throw new Error('Could not load the property.');
  return data ? toProfile(data as Row) : null;
}

export async function writeProfile(p: Omit<PropertyProfile, 'googlePlaceId' | 'googleMapsUri' | 'googleRating' | 'googleReviewCount' | 'googleReviews' | 'googleSyncedAt'>) {
  const { error } = await db().from('be_property_profiles').upsert({
    property_id: p.propertyId, property_type: p.propertyType, display_name: p.displayName, description: p.description, address: p.address,
    latitude: p.latitude, longitude: p.longitude, amenities: p.amenities, ota_presence: p.otaPresence, hidden_room_types: p.hiddenRoomTypes,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error('Could not save the property.');
}

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';
function gatewayHeaders(mask: string) {
  const lovable = process.env['LOVABLE_API_KEY'];
  const maps = process.env['GOOGLE_MAPS_API_KEY'];
  if (!lovable || !maps) throw new Error('Google Maps is not connected.');
  return { Authorization: `Bearer ${lovable}`, 'X-Connection-Api-Key': maps, 'Content-Type': 'application/json', 'X-Goog-FieldMask': mask };
}
async function ok(res: Response) {
  if (res.ok) return res.json();
  const body = await res.text();
  console.error(`Google Maps request failed [${res.status}]: ${body}`);
  throw new Error(res.status === 403 ? 'Google Maps refused the request (403).' : `Google Maps request failed (${res.status}).`);
}

/** Read-only place search (admin-triggered, at most 8 results). Nothing is ever written to Google. */
export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
    method: 'POST', headers: gatewayHeaders('places.id,places.displayName,places.formattedAddress'),
    body: JSON.stringify({ textQuery: query, pageSize: 8, regionCode: 'IN' }),
  });
  const json = (await ok(res)) as { places?: { id: string; displayName?: { text?: string }; formattedAddress?: string }[] };
  return (json.places ?? []).map((p) => ({ placeId: p.id, name: p.displayName?.text ?? '', address: p.formattedAddress ?? '' }));
}

/** One-time copy of the public listing (location, rating, up to 5 public reviews) into the console. */
export async function syncPlace(propertyId: string, placeId: string): Promise<PropertyProfile> {
  const res = await fetch(`${GATEWAY_URL}/places/v1/places/${encodeURIComponent(placeId)}`, {
    headers: gatewayHeaders('id,formattedAddress,location,rating,userRatingCount,googleMapsUri,reviews'),
  });
  const p = (await ok(res)) as {
    formattedAddress?: string; location?: { latitude: number; longitude: number }; rating?: number; userRatingCount?: number; googleMapsUri?: string;
    reviews?: { rating?: number; text?: { text?: string }; originalText?: { text?: string }; authorAttribution?: { displayName?: string }; relativePublishTimeDescription?: string }[];
  };
  const reviews: GoogleReview[] = (p.reviews ?? []).slice(0, 5).map((r) => ({
    author: (r.authorAttribution?.displayName ?? 'Google user').slice(0, 80), rating: r.rating ?? 0,
    text: (r.text?.text ?? r.originalText?.text ?? '').slice(0, 1200), when: (r.relativePublishTimeDescription ?? '').slice(0, 40),
  }));
  const { error } = await db().from('be_property_profiles').upsert({
    property_id: propertyId, google_place_id: placeId, google_maps_uri: p.googleMapsUri ?? null,
    address: p.formattedAddress ?? undefined, latitude: p.location?.latitude ?? null, longitude: p.location?.longitude ?? null,
    google_rating: p.rating ?? null, google_review_count: p.userRatingCount ?? null, google_reviews: reviews,
    google_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  if (error) throw new Error('Could not save the Google details.');
  const out = await readProfile(propertyId);
  if (!out) throw new Error('Property not found.');
  return out;
}
