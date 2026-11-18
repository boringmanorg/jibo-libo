import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /tours (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(tours)/4x4-expedition-meghalaya")({
  beforeLoad: () => {
    throw redirect({ to: "/tours/4x4-expedition-meghalaya", statusCode: 301 });
  },
});
