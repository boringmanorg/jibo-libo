import { createFileRoute, redirect } from "@tanstack/react-router";

// The old property chooser. Every "Check availability" now opens the new booking page; this address
// is kept so old links and bookmarks land there with their location and dates.
export const Route = createFileRoute("/(stays)/book/select")({
  beforeLoad: ({ search }) => {
    const s = search as Record<string, unknown>;
    const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
    const loc = s.location === "dawki" || s.location === "shnonpedeng" ? "shnonpedeng" : "new-shillong";
    throw redirect({ to: "/book", search: { location: loc, checkIn: date(s.checkIn), checkOut: date(s.checkOut) }, replace: true });
  },
});
