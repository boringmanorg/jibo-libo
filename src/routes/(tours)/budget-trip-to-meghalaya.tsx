import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /tours (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(tours)/budget-trip-to-meghalaya")({
  beforeLoad: () => {
    throw redirect({ to: "/tours/budget-trip-to-meghalaya", statusCode: 301 });
  },
});
