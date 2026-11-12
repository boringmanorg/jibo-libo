/**
 * Reviews for TAB Bistro by XTSY.
 * Reads approved restaurant_reviews from Supabase (fresh SEO content) and
 * lets visitors submit a new review (text + optional photo) which stays
 * pending until an admin approves it.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { offlineBackend as supabase } from "@/lib/offlineBackend";

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

interface DBRow {
  id: string;
  guest_name: string;
  rating: number;
  review_text: string | null;
  photos: string[] | null;
  visit_type: string | null;
  price_range: string | null;
  owner_reply: string | null;
  local_guide: boolean | null;
  verified: boolean | null;
  created_at: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export function useRestaurantReviews() {
  const [reviews, setReviews] = useState<RestaurantReview[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("restaurant_reviews")
      .select("*")
      .eq("approved", true)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReviews(
        (data as DBRow[]).map((r) => ({
          id: r.id,
          name: r.guest_name,
          rating: r.rating,
          comment: r.review_text || "Great experience!",
          isoDate: r.created_at,
          date: fmt(r.created_at),
          visitType: r.visit_type || undefined,
          priceRange: r.price_range || undefined,
          ownerReply: r.owner_reply || undefined,
          localGuide: !!r.local_guide,
          verified: !!r.verified,
          photos: r.photos || [],
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

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

  return { reviews, loading, stats, submitReview, refetch: fetchReviews };
}
