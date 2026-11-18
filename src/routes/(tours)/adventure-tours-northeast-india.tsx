import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved under /tours (owner approval, 18 Nov 2026); old address permanently redirects.
export const Route = createFileRoute("/(tours)/adventure-tours-northeast-india")({
  beforeLoad: () => {
    throw redirect({ to: "/tours/adventure-tours-northeast-india", statusCode: 301 });
  },
});
