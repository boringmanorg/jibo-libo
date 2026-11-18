import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /stays (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(stays)/xtsy-adventure-campsite-dawki")({
  beforeLoad: () => {
    throw redirect({ to: "/stays/campsite-dawki", statusCode: 301 });
  },
});
