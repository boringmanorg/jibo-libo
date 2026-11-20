/** Input and result shapes for the Claude trip assistant, shared by the browser and the server. */
import { z } from 'zod';

export const tripAskInput = z.object({
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().min(1).max(2000) })).min(1).max(16),
  /** The browser planner's answer for the latest message: drive times and a day-by-day plan when it made one. */
  draft: z.string().max(4000).optional(),
  page: z.string().max(200).optional(),
}).strict();
export type TripAskInput = z.infer<typeof tripAskInput>;
export type TripAskResult = { ok: true; text: string } | { ok: false; reason: 'off' | 'busy' | 'error' };
