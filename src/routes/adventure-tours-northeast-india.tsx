import { createFileRoute } from '@tanstack/react-router';
import AdventureLanding from '@/pages/expeditions/AdventureLanding';
import { buildRouteHead } from '@/lib/seo-head';
import { articleSchema } from '@/lib/seo/pageEntitySchema';
import { IMG } from '@/data/v2Images';

export const Route = createFileRoute('/adventure-tours-northeast-india')({
  head: () => buildRouteHead({ jsonLd: [articleSchema({ path: '/adventure-tours-northeast-india', headline: 'Adventure Tours in Northeast India | Routes & Permits | XTSY', description: 'Compare Meghalaya, Tawang and Kohima adventure routes from Guwahati: seasons, permits, driving days and practical planning from XTSY.' })], path: '/adventure-tours-northeast-india', title: 'Adventure Tours in Northeast India | Routes & Permits | XTSY', description: 'Compare Meghalaya, Tawang and Kohima adventure routes from Guwahati: seasons, permits, driving days and practical planning from XTSY.', image: new URL(IMG.assam, 'https://xtsy.one').href, ogType: 'article' }),
  component: () => <AdventureLanding guide="adventure-tours-northeast-india" />,
});