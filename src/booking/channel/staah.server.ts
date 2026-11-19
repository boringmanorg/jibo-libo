/**
 * STAAH connector. STAAH enables third-party systems through its ChannelConnect API on request;
 * the message format, endpoints and credentials arrive with that access. Until then this
 * connector reports itself as not connected, and the booking engine cannot launch (launchGate).
 */
import type { ChannelManager } from './channelManager';

export function staahNotConnected(): ChannelManager {
  const refuse = async (): Promise<never> => {
    throw new Error('STAAH is not connected yet. Request ChannelConnect access from STAAH and save the credentials.');
  };
  return { id: 'staah', connected: false, getAri: refuse, pushReservation: refuse };
}
