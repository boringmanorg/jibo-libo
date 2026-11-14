/** Browser-safe service scope shared by indexing, navigation and sitemap generation. */
export type CoveragePage = { slug: string; category?: string; h1?: string };

const MEGHALAYA = /(?:^|-)(meghalaya|shillong|cherrapunji|sohra|dawki|mawlynnong|mawsynram|jowai|tura|shnongpdeng|nongjrong|nongriat|nongstoin|mawphlang|laitlum|umiam)(?:-|$)/i;
const ASSAM = /(?:^|-)(assam|guwahati|kaziranga|majuli|jorhat|tezpur|haflong|dibrugarh|silchar|sivasagar)(?:-|$)/i;
const LOCAL_SHILLONG = /shillong|neigrihms|neigrims|neiah|nift|iim|mlcu|mawdiangdiang|mawpdiang|umpling/i;
const OTHER_NEIGHBOURHOOD = /(?:in|at)-(?:police-bazaar|police-bazar|laitumkhrah|iewduh)|^restaurant-in-police-bazar$|^street-food-police-bazar$/i;
export const EXCLUDED_FOOD_LISTING = /(?:khasi|traditional|jadoh|doh-khlieh|tungrymbai).*(?:food|cuisine|restaurant)|(?:food|cuisine|restaurant).*(?:khasi|traditional|jadoh|doh-khlieh|tungrymbai)/i;

export function excludedFoodListing(slug: string): boolean {
  return EXCLUDED_FOOD_LISTING.test(slug);
}

export function serviceCoverageReason(page: CoveragePage): string | null {
  const { slug, category } = page;
  if (excludedFoodListing(slug)) return 'Excluded Khasi/traditional-food listing';
  if (category === 'group-tours' || /group-tour|school-tour|college-tour|corporate-tour/.test(slug)) {
    return MEGHALAYA.test(slug) ? null : 'Group tours are Meghalaya-only';
  }
  if (/honeymoon/.test(slug)) return MEGHALAYA.test(slug) ? null : 'Honeymoons are Meghalaya-only';
  if (category === 'hostels' || /hostel|dormitory|^dorms-/.test(slug)) {
    if (LOCAL_SHILLONG.test(slug) || /^(isabella-hostel-vs-xtsy|stargaze-hostel-vs-xtsy|zion-backpackers-vs-xtsy|hostel-near-me)$/.test(slug)) return null;
    return 'Hostel coverage is New Shillong and local Shillong searches only';
  }
  if (category === 'restaurants' || category === 'food-dining' || /restaurant|cafe|bistro|food-|dining/.test(slug)) {
    if (OTHER_NEIGHBOURHOOD.test(slug) || /restaurants-(?:in|near)-(?:laitumkhrah|police|iewduh)/.test(slug)) return 'Dining operates in New Shillong, not another neighbourhood';
    return LOCAL_SHILLONG.test(slug) || /tab-bistro/.test(slug) ? null : 'Dining coverage is New Shillong and local Shillong searches only';
  }
  if (category === 'rentals' || /rental|self-drive-car|car-booking|bike-hire|car-hire/.test(slug)) {
    return MEGHALAYA.test(slug) || ASSAM.test(slug) || slug === 'xtsy-rentals' ? null : 'Rentals cover Assam and Meghalaya only';
  }
  // General tours, expeditions and informational destination guides remain unrestricted.
  return null;
}