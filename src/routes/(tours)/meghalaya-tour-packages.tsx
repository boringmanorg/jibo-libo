import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /tours (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(tours)/meghalaya-tour-packages")({
  beforeLoad: () => {
    throw redirect({ to: "/tours/meghalaya-tour-packages", statusCode: 301 });
  },
});
