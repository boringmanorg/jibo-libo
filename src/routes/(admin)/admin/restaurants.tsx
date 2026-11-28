import { createFileRoute, Navigate } from '@tanstack/react-router';
import { buildRouteHead } from '@/lib/seo-head';

export const Route = createFileRoute('/(admin)/admin/restaurants')({
  head: () => buildRouteHead({ path: '/admin/restaurants', title: 'Property Console — XTSY', description: 'Private XTSY property operations console.', noIndex: true }),
  component: RetiredRestaurantConsole,
});
function RetiredRestaurantConsole() {
  return <Navigate to="/admin" replace />;
}
