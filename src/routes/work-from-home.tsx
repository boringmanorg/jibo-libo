import { createFileRoute } from "@tanstack/react-router";
import { articleSchema } from "@/lib/seo/pageEntitySchema";
import WorkationV2 from "@/pages/v2/WorkationV2";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/work-from-home")({
  head: () =>
    buildRouteHead({
      path: "/work-from-home",
      jsonLd: [articleSchema({ path: "/work-from-home", headline: "Work From Meghalaya: Wifi, Desks & Long Stays | XTSY", description: "Remote work from Shillong at XTSY: wifi speeds, dedicated desks, power backup, quiet hours and discounted weekly and monthly long-stay rates." })],
      title: "Work From Meghalaya: Wifi, Desks & Long Stays | XTSY",
      description:
        "Remote work from Shillong at XTSY: wifi speeds, dedicated desks, power backup, quiet hours and discounted weekly and monthly long-stay rates.",
    }),
  component: WorkationV2,
});
