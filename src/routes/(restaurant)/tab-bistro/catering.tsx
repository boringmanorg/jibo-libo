import { createFileRoute } from "@tanstack/react-router";
import { articleSchema } from "@/lib/seo/pageEntitySchema";
import CateringV2 from "@/pages/v2/CateringV2";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/(restaurant)/tab-bistro/catering")({
  head: () =>
    buildRouteHead({
      path: "/tab-bistro/catering",
      jsonLd: [articleSchema({ path: "/tab-bistro/catering", headline: "Catering in Shillong for Events & Groups | TAB Bistro", description: "TAB Bistro by XTSY handles catering in Shillong for weddings, corporate events, retreats and group stays, with set menus, live counters and per-plate pricing." })],
      title: "Catering in Shillong for Events & Groups | TAB Bistro",
      description:
        "TAB Bistro by XTSY handles catering in Shillong for weddings, corporate events, retreats and group stays, with set menus, live counters and per-plate pricing.",
    }),
  component: CateringShillong,
});

function CateringShillong() {
  return <CateringV2 canonical="https://xtsy.one/tab-bistro/catering" />;
}
