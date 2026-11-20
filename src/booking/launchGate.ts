/**
 * /book switches from WhatsApp enquiry to live booking only when every condition holds.
 * Selling without STAAH would let an OTA and the website sell the same bed.
 */
export interface LaunchState {
  /** The owner's switch in the admin console. */
  switchedOn: boolean;
  gatewayConfigured: boolean;
  /** Cloudflare Turnstile keys saved, so checkout can stop bots holding rooms. */
  botProtection: boolean;
  channelConnected: boolean;
  unmappedRoomTypes: string[];
  feeTableProblems: string[];
  databaseReady: boolean;
}

export function launchBlockers(s: LaunchState): string[] {
  const out: string[] = [];
  if (!s.databaseReady) out.push('Booking database is not set up yet.');
  if (!s.channelConnected) out.push('STAAH is not connected.');
  if (s.unmappedRoomTypes.length) out.push(`Room types not mapped to STAAH: ${s.unmappedRoomTypes.join(', ')}.`);
  if (!s.gatewayConfigured) out.push('Payment gateway keys are not saved.');
  if (!s.botProtection) out.push('Bot protection keys (Cloudflare Turnstile) are not saved.');
  if (s.feeTableProblems.length) out.push(...s.feeTableProblems);
  if (!s.switchedOn) out.push('Live booking is switched off in the admin console.');
  return out;
}

export const canTakeLiveBookings = (s: LaunchState): boolean => launchBlockers(s).length === 0;
