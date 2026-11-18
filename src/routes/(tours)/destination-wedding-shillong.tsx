import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /tours (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(tours)/destination-wedding-shillong")({
  beforeLoad: () => {
    throw redirect({ to: "/tours/destination-wedding-shillong", statusCode: 301 });
  },
});
