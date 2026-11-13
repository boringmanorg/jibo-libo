import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  beforeLoad: () => {
    // 301, not the router default of 307: this rename is permanent, and a 307
    // tells Google not to consolidate the old URL's ranking onto the new one.
    throw redirect({ to: "/terms-of-service", replace: true, statusCode: 301 });
  },
});
