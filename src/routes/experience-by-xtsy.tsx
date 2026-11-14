import { createFileRoute } from "@tanstack/react-router";
import ExperienceByXtsy from "@/pages/v2/ExperienceByXtsy";
import { experienceSchema } from "@/pages/v2/experienceData";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/experience-by-xtsy")({
  head: () =>
    buildRouteHead({
      path: "/experience-by-xtsy",
      ogType: "product",
      jsonLd: [experienceSchema()],
      title: "Experience by XTSY | Glass Glamping for Two, New Shillong",
      description:
        "Stay in a 270° panoramic glass suite for two in New Shillong Township, Meghalaya. View photos, amenities and rates; enquire on WhatsApp for availability.",
    }),
  component: ExperienceByXtsy,
});
