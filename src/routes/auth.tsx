import { createFileRoute, redirect } from '@tanstack/react-router';

// Guest sign-in and accounts are retired: XTSY has no public sign-in. Old links go home.
export const Route = createFileRoute('/auth')({
  beforeLoad: () => {
    throw redirect({ to: '/', statusCode: 301 });
  },
});
