import { createFileRoute } from "@tanstack/react-router";
import { articleSchema } from "@/lib/seo/pageEntitySchema";
import PetFriendlyV2 from "@/pages/v2/PetFriendlyV2";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/pet-friendly")({
  head: () =>
    buildRouteHead({
      path: "/pet-friendly",
      jsonLd: [articleSchema({ path: "/pet-friendly", headline: "Pet Friendly Stay in Shillong, Meghalaya | XTSY", description: "Travelling with a pet in Meghalaya? See XTSY's pet policy, which room types allow pets, nearby vets, and walking routes around New Shillong Township." })],
      title: "Pet Friendly Stay in Shillong, Meghalaya | XTSY",
      description:
        "Travelling with a pet in Meghalaya? See XTSY's pet policy, which room types allow pets, nearby vets, and walking routes around New Shillong Township.",
    }),
  component: PetFriendlyV2,
});
