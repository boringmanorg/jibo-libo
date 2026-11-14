import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Short alias for the vehicle rental page. The canonical page lives at
 * /xtsy-rentals; this URL permanently redirects there.
 */
export const Route = createFileRoute("/rentals")({
  beforeLoad: () => {
    throw redirect({ to: "/xtsy-rentals", statusCode: 301 });
  },
});
