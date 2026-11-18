/**
 * Contracts between xtsy.one (guest front-end) and posbyxtsy.club:
 *  - PMS by XTSY for Hotels  → stays, room inventory, bookings
 *  - POS by XTSY for Restaurants → outlets, tables, QR ordering
 * Browser-safe: types and pure helpers only, no secrets.
 */
export type CountryCode = string; // ISO 3166-1 alpha-2, e.g. "IN"
export type CurrencyCode = string; // ISO 4217, e.g. "INR"
export type TaxType = 'GST' | 'VAT' | 'SST' | 'NONE';

export interface GeoLocation {
  continent: 'asia' | 'europe';
  countryCode: CountryCode;
  countrySlug: string;
  region: string;
  citySlug: string;
  city: string;
  address: string;
  coordinates?: { lat: number; lng: number };
}

export interface TaxConfig {
  type: TaxType;
  /** Prices are shown exclusive of tax unless true. */
  inclusive: boolean;
}

export interface FranchiseInfo {
  franchiseId: string;
  ownership: 'company' | 'franchise';
}

/* ---------------- PMS (hotels) ---------------- */
export interface PmsProperty {
  propertyId: string;
  slug: string;
  name: string;
  brand: 'xtsy-hostel' | 'experience-by-xtsy';
  status: 'active' | 'coming-soon' | 'paused';
  /** Site path for this property's page. */
  path: string;
  location: GeoLocation;
  currency: CurrencyCode;
  locale: string;
  timezone: string;
  tax: TaxConfig;
  deskWhatsapp: string;
  checkIn: string;
  checkOut: string;
  franchise: FranchiseInfo;
  unitTypeIds: string[];
}

export interface PmsAvailabilityRequest {
  propertyId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string;
  guests: number;
}

export interface PmsUnitAvailability {
  unitTypeId: string;
  available: number;
  nightlyRate: number;
  currency: CurrencyCode;
}

export interface PmsAvailabilityResponse {
  propertyId: string;
  units: PmsUnitAvailability[];
  source: 'pms' | 'static';
}

export interface PmsEnquiryRequest {
  propertyId: string;
  unitTypeId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guestName: string;
  guestPhone: string;
  notes?: string;
}

/* ---------------- POS (restaurants) ---------------- */
export interface ServiceWindow { opens: string; closes: string }

export interface PosOutlet {
  outletId: string;
  brandSlug: 'tab-bistro';
  outletSlug: string;
  name: string;
  status: 'active' | 'coming-soon' | 'paused';
  path: string;
  location: GeoLocation;
  currency: CurrencyCode;
  timezone: string;
  tax: TaxConfig;
  deskWhatsapp: string;
  serviceWindows: {
    breakfast?: ServiceWindow;
    lunch?: ServiceWindow & { mode: 'preorder-only' | 'standard' };
    dinner?: ServiceWindow & { lastOrder: string };
  };
  franchise: FranchiseInfo;
}

export interface PosTableRequest {
  outletId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  service: 'breakfast' | 'lunch-preorder' | 'dinner';
  partySize: number;
  guestName: string;
  guestPhone: string;
  notes?: string;
}

export interface PosTableSlotsResponse {
  outletId: string;
  date: string;
  slots: string[];
  source: 'pos' | 'static';
}

/** Result of a write call; `forwarded` false means the integration is switched off. */
export interface SaasWriteResult {
  forwarded: boolean;
  reference?: string;
  reason?: string;
}

/** Builds the in-venue QR ordering link for a table. */
export function buildQrOrderUrl(baseUrl: string, outletId: string, tableId: string): string {
  const url = new URL(`/order/${encodeURIComponent(outletId)}`, baseUrl);
  url.searchParams.set('table', tableId);
  return url.toString();
}
