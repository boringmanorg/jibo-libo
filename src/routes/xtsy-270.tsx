import { createFileRoute } from "@tanstack/react-router";
import ExperienceByXtsy from "@/pages/v2/ExperienceByXtsy";
import { experienceSchema } from "@/pages/v2/experienceData";
import { buildRouteHead } from "@/lib/seo-head";

/**
 * The glass suite's original address. The product is now called
 * "Experience by XTSY", but this URL must keep serving (owner instruction:
 * keep /xtsy-270 unchanged) — it holds the inbound links and rankings.
 *
 * So: 200, same page, and `path` is set to the new slug on purpose so the
 * canonical and og:url point at /experience-by-xtsy. That consolidates
 * ranking on the new slug while this URL still works for anyone arriving
 * on it. Do NOT add noIndex here: a noindex alongside a cross-page
 * canonical sends Google conflicting signals.
 */
export const Route = createFileRoute("/xtsy-270")({
  head: () =>
    buildRouteHead({
      path: "/experience-by-xtsy",
      ogType: "product",
      jsonLd: [experienceSchema()],
      title: "Experience by XTSY: Romantic Couple Stay, New Shillong",
      description:
        "Experience by XTSY, India's first stargaze glamp: a 270° panoramic glass suite in New Shillong Township. Photos, what's included and rates. Book direct.",
    }),
  component: ExperienceByXtsy,
});
