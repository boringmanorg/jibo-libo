import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy address of the glass suite. Owner decision (14 Nov 2026): the page
 * lives at /experience-by-xtsy; this old URL permanently redirects there.
 */
export const Route = createFileRoute("/(stays)/xtsy-270")({
  beforeLoad: () => {
    throw redirect({ to: "/stays/experience-by-xtsy", statusCode: 301 });
  },
});
