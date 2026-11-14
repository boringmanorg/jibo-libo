import { createFileRoute } from "@tanstack/react-router";
import TabBistro from "@/pages/v2/BistroV2";
import { buildRouteHead } from "@/lib/seo-head";
import { RESTAURANT_SCHEMA } from "@/data/siteSchemas";

export const Route = createFileRoute("/tab-bistro/")({
  head: () =>
    buildRouteHead({
      path: "/tab-bistro",
      title: "TAB Bistro New Shillong: Tandoor, Biryani & Indo-Chinese",
      description:
        "Browse TAB Bistro’s menu in New Shillong Township: tandoor, biryani and Indo-Chinese. Request a breakfast or dinner table; lunch by confirmed preorder only.",
      keywords:
        "restaurant in shillong, best restaurant shillong, multi cuisine restaurant shillong, restaurant in new shillong township, biryani in shillong, tandoor restaurant shillong, wedding catering shillong, TAB Bistro",
      jsonLd: [RESTAURANT_SCHEMA],
    }),
  component: TabBistro,
});
