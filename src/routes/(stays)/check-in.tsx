import { createFileRoute } from '@tanstack/react-router';
import SelfCheckIn from '@/pages/SelfCheckIn';
import { buildRouteHead } from '@/lib/seo-head';
import { z } from 'zod';

export const Route = createFileRoute('/(stays)/check-in')({
  ssr: false,
  validateSearch: z.object({ property: z.enum(['XTSY-SHL-HOSTEL', 'XTSY-SHN-CAMP']).optional() }),
  head: () => buildRouteHead({
    path: '/check-in',
    noIndex: true,
    noIndexFollow: true,
    title: 'Self Check-in | XTSY Stays',
    description: 'Secure self check-in for XTSY Travellers Hostel and Shnonpedeng Riverside Camping by XTSY.',
  }),
  component: CheckInPage,
});

function CheckInPage() {
  const { property } = Route.useSearch();
  return <SelfCheckIn key={property ?? 'choose'} {...(property ? { initialPropertyId: property } : {})} />;
}
