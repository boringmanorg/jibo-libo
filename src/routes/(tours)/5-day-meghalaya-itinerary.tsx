import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /tours (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(tours)/5-day-meghalaya-itinerary")({
  beforeLoad: () => {
    throw redirect({ to: "/tours/5-day-meghalaya-itinerary", statusCode: 301 });
  },
});
