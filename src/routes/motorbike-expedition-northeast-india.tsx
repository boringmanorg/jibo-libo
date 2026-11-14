import { createFileRoute } from '@tanstack/react-router';
import AdventureLanding from '@/pages/expeditions/AdventureLanding';
import { buildRouteHead } from '@/lib/seo-head';
import { articleSchema } from '@/lib/seo/pageEntitySchema';
import { IMG } from '@/data/v2Images';

export const Route = createFileRoute('/motorbike-expedition-northeast-india')({
  head: () => buildRouteHead({ jsonLd: [articleSchema({ path: '/motorbike-expedition-northeast-india', headline: 'Northeast India Motorbike Expedition — Routes | XTSY', description: 'Compare Meghalaya, Tawang and Kohima motorbike expeditions with practical advice on road conditions, permits, altitude, seasons and riding gear.' })], path: '/motorbike-expedition-northeast-india', title: 'Northeast India Motorbike Expedition — Routes | XTSY', description: 'Compare Meghalaya, Tawang and Kohima motorbike expeditions with practical advice on road conditions, permits, altitude, seasons and riding gear.', image: new URL(IMG.bumla, 'https://xtsy.one').href, ogType: 'article' }),
  component: () => <AdventureLanding guide="motorbike-expedition-northeast-india" />,
});