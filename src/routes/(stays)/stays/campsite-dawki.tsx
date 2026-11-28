import { createFileRoute } from "@tanstack/react-router";
import XTSYAdventureCampsiteDawki from "@/pages/v2/CampsiteV2";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/(stays)/stays/campsite-dawki")({
  head: () =>
    buildRouteHead({
      path: "/stays/campsite-dawki",
      title: "Shnonpedeng Riverside Camping by XTSY | Umngot River",
      description:
        "Riverside tents on the Umngot at Shnonpedeng, an XTSY franchise partner camp: full tent for two ₹1,400 a night, ₹700 a person, bonfire and meals on request.",
    }),
  component: XTSYAdventureCampsiteDawki,
});
