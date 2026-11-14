import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy address of the glass suite. Owner decision (14 Nov 2026): the page
 * lives at /experience-by-xtsy; this old URL permanently redirects there.
 */
export const Route = createFileRoute("/xtsy-270")({
  beforeLoad: () => {
    throw redirect({ to: "/experience-by-xtsy", statusCode: 301 });
  },
});
