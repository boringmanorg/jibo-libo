import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /stays (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(stays)/experience-by-xtsy")({
  beforeLoad: () => {
    throw redirect({ to: "/stays/experience-by-xtsy", statusCode: 301 });
  },
});
