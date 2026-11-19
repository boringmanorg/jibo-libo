/**
 * One interface for every payment gateway. The booking engine talks only to this;
 * which gateway runs is a console setting, so switching gateways never touches the booking flow.
 */
import type { Paise } from '../money';
import type { PaymentMethod } from './fees';

export type GatewayId = 'zoho' | 'razorpay';

export interface CheckoutRequest {
  /** XTSY booking reference, e.g. XTSY-7KQ2M; also the gateway's reference number. */
  reference: string;
  amount: Paise;
  description: string;
  method: PaymentMethod;
  successUrl: string;
  failureUrl: string;
  /** Seconds the checkout stays open; matches the room hold. */
  expiresInSeconds: number;
}

export interface Checkout { sessionId: string; redirectUrl: string }

export interface PaymentLinkRequest { reference: string; amount: Paise; description: string; method?: PaymentMethod; expiresOn: string }
export interface PaymentLink { linkId: string; url: string }

export type SessionStatus = 'succeeded' | 'failed' | 'pending' | 'expired' | 'unknown';
export interface SessionState { status: SessionStatus; paymentIds: string[]; amount: Paise }

/** What a verified webhook points at. It is a trigger only: status is always re-read from the gateway. */
export interface WebhookPointer { sessionId?: string; linkId?: string; paymentId?: string }

export interface PaymentGateway {
  id: GatewayId;
  createCheckout(req: CheckoutRequest): Promise<Checkout>;
  createPaymentLink(req: PaymentLinkRequest): Promise<PaymentLink>;
  getSession(sessionId: string): Promise<SessionState>;
  /** Null when the signature or timestamp fails: the request is ignored. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookPointer | null>;
  /** True only when the success/failure redirect's signature is genuine. Status still comes from getSession. */
  verifyReturn(params: URLSearchParams): Promise<boolean>;
}

/** Each confirmation is processed once: repeat deliveries of the same event map to the same key. */
export const webhookKey = (gateway: GatewayId, p: WebhookPointer): string =>
  `${gateway}:${p.sessionId ?? '-'}:${p.linkId ?? '-'}:${p.paymentId ?? '-'}`;
