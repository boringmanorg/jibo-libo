import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /tours (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(tours)/meghalaya-couple-tour-package")({
  beforeLoad: () => {
    throw redirect({ to: "/tours/meghalaya-couple-tour-package", statusCode: 301 });
  },
});
