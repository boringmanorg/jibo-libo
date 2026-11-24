/** Compatibility endpoint: paid guest answers remain unconditionally disabled. */
import { createServerFn } from '@tanstack/react-start';
import { tripAskInput, type TripAskResult } from './tripAssistant.shared';

export const askTripAssistantFn = createServerFn({ method: 'POST' })
  .inputValidator(tripAskInput)
  .handler(async (): Promise<TripAskResult> => ({ ok: false, reason: 'off' }));
