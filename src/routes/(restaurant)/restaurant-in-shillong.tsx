import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /tab-bistro (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(restaurant)/restaurant-in-shillong")({
  beforeLoad: () => {
    throw redirect({ to: "/tab-bistro", statusCode: 301 });
  },
});
