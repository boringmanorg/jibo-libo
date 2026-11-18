import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /stays (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(stays)/group-bookings-meghalaya")({
  beforeLoad: () => {
    throw redirect({ to: "/stays/group-bookings-meghalaya", statusCode: 301 });
  },
});
