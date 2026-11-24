/** Browser-callable server function for the Claude trip assistant (see tripAssistant.server.ts). */
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { tripAskInput, type TripAskResult } from './tripAssistant.shared';

export const askTripAssistantFn = createServerFn({ method: 'POST' })
  .inputValidator(tripAskInput)
  .handler(async ({ data }): Promise<TripAskResult> => {
    const { askTripAssistant, allow, visitorOf, fromOwnSite } = await import('./tripAssistant.server');
    if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: 'off' };
    const req = getRequest();
    if (!fromOwnSite(req)) return { ok: false, reason: 'busy' };
    if (!allow(visitorOf(req))) return { ok: false, reason: 'busy' };
    return askTripAssistant(data, process.env);
  });
