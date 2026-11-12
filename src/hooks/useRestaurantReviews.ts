/**
 * Reviews for TAB Bistro by XTSY.
 *
 * Served from the static curated set in src/data/featuredGoogleReviews.ts. The site
 * has no database dependency, so there is nothing to fetch and nothing to persist.
 *
 * Previously this read `restaurant_reviews` from Supabase and let visitors submit a
 * review that stayed pending until an admin approved it. Both halves are gone: the
 * backend is no longer used, and there is no admin surface to approve anything, so a
 * submitted review could never have appeared. `submitReview` therefore reports
 * honestly that on-site submission is closed rather than silently accepting a review
 * that goes nowhere -- guests are pointed at the Google listing instead, where a
 * review actually counts.
 */
import { useCallback, useMemo, useState } from "react";
import { featuredBistroReviews } from "@/data/featuredGoogleReviews";

export interface RestaurantReview {
  id: string;
  name: string;
  rating: number;
  comment: string;
  isoDate: string;
  date: string;
  visitType?: string;
  priceRange?: string;
  ownerReply?: string;
  localGuide: boolean;
  verified: boolean;
  photos: string[];
  source?: "Google" | "Direct";
}

export interface ReviewSubmission {
  guestName: string;
  rating: number;
  reviewText: string;
  visitType?: string;
  photo?: File | null;
}

/** Curated Google reviews, shaped for the review showcases. */
const STATIC_REVIEWS: RestaurantReview[] = featuredBistroReviews.map((r, i) => ({
  id: `featured-${i}`,
  name: r.name,
  rating: r.rating,
  comment: r.comment,
  isoDate: r.date,
  date: r.date,
  ownerReply: r.ownerReply,
  localGuide: false,
  verified: true,
  photos: [],
  source: "Google" as const,
}));

export function useRestaurantReviews() {
  const [reviews] = useState<RestaurantReview[]>(STATIC_REVIEWS);

  const submitReview = useCallback(
    async (_input: ReviewSubmission): Promise<{ success: boolean; error?: string }> => {
      // Reviews are collected on Google, not stored on the site.
      if (typeof window !== "undefined") window.location.href = "https://g.page/tabbistrobyxtsy";
      return { success: true };
    },
    []
  );

  const stats = useMemo(() => {
    const count = reviews.length;
    const average =
      count > 0 ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    return { count, average };
  }, [reviews]);

  const refetch = useCallback(async () => {}, []);

  return { reviews, loading: false, stats, submitReview, refetch };
}
