import { createFileRoute } from '@tanstack/react-router';
import SelfCheckIn from '@/pages/SelfCheckIn';
import { buildRouteHead } from '@/lib/seo-head';

export const Route = createFileRoute('/(stays)/check-in')({
  ssr: false,
  head: () => buildRouteHead({
    path: '/check-in',
    noIndex: true,
    noIndexFollow: true,
    title: 'Self Check-in | XTSY Stays',
    description: 'Secure self check-in for XTSY Travellers Hostel and Shnonpedeng Riverside Camping by XTSY.',
  }),
  component: SelfCheckIn,
});
