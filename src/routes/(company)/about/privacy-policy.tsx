import { createFileRoute } from "@tanstack/react-router";
import { infoPageSchema } from "@/lib/seo/pageEntitySchema";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/(company)/about/privacy-policy")({
  head: () =>
    buildRouteHead({
      path: "/about/privacy-policy",
      jsonLd: [infoPageSchema({ path: "/about/privacy-policy", name: "Privacy Policy | XTSY Travellers Hostel Shillong", description: "How XTSY collects, uses and protects your personal data for hostel bookings, tours and dining. GDPR and India DPDP compliant privacy policy." })],
      title: "Privacy Policy | XTSY Travellers Hostel Shillong",
      description:
        "How XTSY collects, uses and protects your personal data for hostel bookings, tours and dining. GDPR and India DPDP compliant privacy policy.",
      keywords: "XTSY privacy policy, data protection, DPDP compliance, booking privacy",
    }),
  component: PrivacyPolicy,
});
