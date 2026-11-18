import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /stays (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(stays)/luxury-glamping-shillong")({
  beforeLoad: () => {
    throw redirect({ to: "/stays/luxury-glamping-shillong", statusCode: 301 });
  },
});
