import { createFileRoute, redirect } from "@tanstack/react-router";

// Partner sign-in is retired: XTSY has no logins. Old links go home.
export const Route = createFileRoute("/(admin)/franchise/install")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 });
  },
});
