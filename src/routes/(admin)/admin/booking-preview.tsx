import { createFileRoute } from '@tanstack/react-router';
import StayEngine from '@/components/booking/engine/StayEngine';

/** The guest booking page as guests will see it, with payment switched off. */
export const Route = createFileRoute('/(admin)/admin/booking-preview')({ component: () => <StayEngine mode="preview" /> });
