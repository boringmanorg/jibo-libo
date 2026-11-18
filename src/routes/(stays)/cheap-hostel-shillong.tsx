import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/(stays)/cheap-hostel-shillong')({
  beforeLoad: () => {
    throw redirect({ to: '/budget-hostels-shillong', statusCode: 301 });
  },
});
