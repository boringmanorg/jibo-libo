import { createFileRoute } from "@tanstack/react-router";
import { articleSchema } from "@/lib/seo/pageEntitySchema";
import BlogItinerary3Day from "@/pages/destinations/BlogItinerary3Day";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/3-day-meghalaya-itinerary")({
  head: () =>
    buildRouteHead({
      path: "/3-day-meghalaya-itinerary",
      jsonLd: [articleSchema({ path: "/3-day-meghalaya-itinerary", headline: "3 Day Meghalaya Itinerary from Shillong | XTSY", description: "A tested 3 day Meghalaya itinerary: Shillong, Cherrapunji waterfalls and Dawki's Umngot river, with travel times, costs and hostel stays from Rs 399." })],
      title: "3 Day Meghalaya Itinerary from Shillong | XTSY",
      description:
        "A tested 3 day Meghalaya itinerary: Shillong, Cherrapunji waterfalls and Dawki's Umngot river, with travel times, costs and hostel stays from Rs 399.",
    }),
  component: BlogItinerary3Day,
});
