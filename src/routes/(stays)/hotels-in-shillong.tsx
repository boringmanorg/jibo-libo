import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /stays (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(stays)/hotels-in-shillong")({
  beforeLoad: () => {
    throw redirect({ to: "/stays/hotels-in-shillong", statusCode: 301 });
  },
});
