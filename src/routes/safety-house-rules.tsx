import { createFileRoute } from '@tanstack/react-router';
import { articleSchema } from "@/lib/seo/pageEntitySchema";
import HostelSafetyV2 from '@/pages/v2/HostelSafetyV2';
import { buildRouteHead } from '@/lib/seo-head';
import { COVERS } from '@/data/v2Images';

export const Route = createFileRoute('/safety-house-rules')({
  head: () => buildRouteHead({
    path: '/safety-house-rules',
      jsonLd: [articleSchema({ path: '/safety-house-rules', headline: 'Hostel Safety & House Rules | XTSY', description: 'XTSY dorm rules, women-only stays, 11 AM check-in, strict 10 AM check-out and quiet hours 10 PM–7 AM in New Shillong Township.' })],
    title: 'Hostel Safety & House Rules | XTSY',
    description: 'XTSY dorm rules, women-only stays, 11 AM check-in, strict 10 AM check-out and quiet hours 10 PM–7 AM in New Shillong Township.',
    image: new URL(COVERS.home, 'https://xtsy.one').href,
    ogType: 'article',
  }),
  component: HostelSafetyV2,
});