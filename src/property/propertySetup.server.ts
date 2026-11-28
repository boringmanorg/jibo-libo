import { getServiceClient } from '@/admin/serviceClient.server';
import type { GoogleReview, PropertyProfile, PropertyType } from './propertySetup';

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

export async function writeProfile(p: Omit<PropertyProfile, 'googlePlaceId' | 'googleRating' | 'googleReviewCount' | 'googleReviews' | 'googleSyncedAt'>) {
  const { error } = await db().from('be_property_profiles').upsert({
    property_id: p.propertyId, property_type: p.propertyType, display_name: p.displayName, description: p.description, address: p.address,
    latitude: p.latitude, longitude: p.longitude, google_maps_uri: p.googleMapsUri, amenities: p.amenities, ota_presence: p.otaPresence, hidden_room_types: p.hiddenRoomTypes,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error('Could not save the property.');
}
