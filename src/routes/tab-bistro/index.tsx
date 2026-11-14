import { createFileRoute } from "@tanstack/react-router";
import TabBistro from "@/pages/v2/BistroV2";
import { buildRouteHead } from "@/lib/seo-head";
import { RESTAURANT_SCHEMA } from "@/data/siteSchemas";
import { BISTRO_HOURS_META } from "@/data/tabBistroHours";

export const Route = createFileRoute("/tab-bistro/")({
  head: () =>
    buildRouteHead({
      path: "/tab-bistro",
      // GSC 1-28 Oct: 1,004 impressions, 2 clicks. The old title was a bare
      // keyword with no reason to click; name the food instead.
      title: "Restaurant in New Shillong: Tandoor, Biryani & Indo-Chinese",
      description:
        // The old text advertised Thai, Continental and Italian, none of which
        // are on the menu. Describe what the kitchen actually cooks.
        `TAB Bistro, New Shillong: tandoor, dum biryani & Indo-Chinese. ${BISTRO_HOURS_META}`,
      keywords:
        "restaurant in shillong, best restaurant shillong, multi cuisine restaurant shillong, restaurant in new shillong township, biryani in shillong, tandoor restaurant shillong, wedding catering shillong, TAB Bistro",
      jsonLd: [RESTAURANT_SCHEMA],
    }),
  component: TabBistro,
});
