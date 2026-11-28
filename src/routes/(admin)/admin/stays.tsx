import { createFileRoute, redirect } from '@tanstack/react-router';

/** Old Blocks screen: its tools now live in Inventory → Bulk edit. Kept so saved links still work. */
export const Route = createFileRoute('/(admin)/admin/stays')({
  beforeLoad: ({ search }) => { throw redirect({ to: '/admin/inventory', search: { ...(search as Record<string, unknown>), view: 'bulk' } as never, replace: true }); },
});
