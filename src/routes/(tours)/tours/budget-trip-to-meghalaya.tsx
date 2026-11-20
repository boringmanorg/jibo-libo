import { createFileRoute } from "@tanstack/react-router";
import { articleSchema } from "@/lib/seo/pageEntitySchema";
import BlogBudgetTrip from "@/pages/destinations/BlogBudgetTrip";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/(tours)/tours/budget-trip-to-meghalaya")({
  head: () =>
    buildRouteHead({
      path: "/tours/budget-trip-to-meghalaya",
      jsonLd: [articleSchema({ path: "/tours/budget-trip-to-meghalaya", headline: "Budget Trip to Meghalaya: Costs & Plan | XTSY", description: "What a Meghalaya trip really costs: transport, permits, food, entry fees and dorm beds from Rs 400, with a sample low-budget route from Guwahati." })],
      title: "Budget Trip to Meghalaya: Costs & Plan | XTSY",
      description:
        "What a Meghalaya trip really costs: transport, permits, food, entry fees and dorm beds from Rs 400, with a sample low-budget route from Guwahati.",
    }),
  component: BlogBudgetTrip,
});
