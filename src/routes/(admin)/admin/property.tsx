import { createFileRoute, redirect } from '@tanstack/react-router';

/** Property setup now lives in Booking Config; kept so saved links still work. */
export const Route = createFileRoute('/(admin)/admin/property')({
  beforeLoad: ({ search }) => { throw redirect({ to: '/admin/booking-engine', search: { ...(search as Record<string, unknown>), tab: 'property' } as never, replace: true }); },
});
