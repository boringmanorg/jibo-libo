/** Retired paid assistant. Guest requests cannot perform metered inference. */
import type { TripAskInput, TripAskResult } from './tripAssistant.shared';

/** Deliberately independent of credentials, guest identity and supplied context. */
export async function askTripAssistant(
  _input: TripAskInput,
  _env: Record<string, string | undefined> = {},
  _fetchImpl?: typeof fetch,
): Promise<TripAskResult> {
  return { ok: false, reason: 'off' };
}
