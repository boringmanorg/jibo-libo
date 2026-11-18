import { createFileRoute } from "@tanstack/react-router";
import TabBistro from "@/pages/TabBistro";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/(restaurant)/restaurant-in-shillong")({
  head: () =>
    buildRouteHead({
      path: "/restaurant-in-shillong",
      title: "Restaurant in Shillong: TAB Bistro by XTSY",
      description:
        "TAB Bistro by XTSY in New Shillong Township: explore the menu, breakfast and dinner hours, lunch preorders and WhatsApp table requests.",
    }),
  component: TabBistro,
});
