import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /stays (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(stays)/homestays-in-shillong")({
  beforeLoad: () => {
    throw redirect({ to: "/stays/homestays-in-shillong", statusCode: 301 });
  },
});
