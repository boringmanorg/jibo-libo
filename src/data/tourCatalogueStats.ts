import { SIGNATURE_PACKAGES } from './signaturePackages';
import { getAllTours } from './travelData';

/** Counts the cards in both sections of /tours, not overlapping filter totals. */
export function getTourCatalogueStats() {
  const tours = getAllTours();
  const international = tours.filter((tour) => tour.international).length;
  const domestic = SIGNATURE_PACKAGES.length + tours.length - international;
  return { total: domestic + international, domestic, international };
}