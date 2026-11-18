import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /stays (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(stays)/female-travellers")({
  beforeLoad: () => {
    throw redirect({ to: "/stays/female-travellers", statusCode: 301 });
  },
});
