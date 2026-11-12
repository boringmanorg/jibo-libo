import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old glass suite address; permanently moved to /experience-by-xtsy. */
export const Route = createFileRoute("/xtsy-270")({
  beforeLoad: () => {
    throw redirect({ to: "/experience-by-xtsy", statusCode: 301 });
  },
});
