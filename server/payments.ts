import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { CURRENCY } from '../shared/contracts';

export interface IntentSummary {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  metadata: Record<string, string>;
}

export interface CreateIntentParams {
  amountCents: number;
  email: string;
  metadata: Record<string, string>;
}

/** The slice of Stripe the API needs. Swapped for an in-memory fake when no secret key is set. */
export interface PaymentGateway {
  readonly kind: 'stripe' | 'mock';
  readonly publishableKey: string;
  createIntent(params: CreateIntentParams): Promise<{ id: string; clientSecret: string }>;
  retrieveIntent(id: string): Promise<IntentSummary | null>;
}

export class StripeGateway implements PaymentGateway {
  readonly kind = 'stripe';
  private readonly stripe: Stripe;

  constructor(secretKey: string, readonly publishableKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createIntent({ amountCents, email, metadata }: CreateIntentParams) {
    const intent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: CURRENCY,
      // No redirect-based methods, so the browser can always confirm in-page
      // (redirect: 'if_required'). The Payment Element is narrowed to cards client-side.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      receipt_email: email,
      metadata
    });
    if (!intent.client_secret) throw new Error(`PaymentIntent ${intent.id} has no client_secret`);
    return { id: intent.id, clientSecret: intent.client_secret };
  }

  async retrieveIntent(id: string): Promise<IntentSummary | null> {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(id);
      return {
        id: intent.id,
        status: intent.status,
        amountCents: intent.amount,
        currency: intent.currency,
        metadata: intent.metadata
      };
    } catch (err) {
      if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === 'resource_missing') return null;
      throw err;
    }
  }
}

/**
 * In-memory stand-in used for local development without keys and for Playwright.
 * Intents only become `succeeded` via markSucceeded(), which the fake Stripe.js
 * reaches through a mock-only route (see app.ts).
 */
export class MockGateway implements PaymentGateway {
  readonly kind = 'mock';
  readonly publishableKey = 'pk_test_mock';
  private readonly intents = new Map<string, IntentSummary>();

  async createIntent({ amountCents, metadata }: CreateIntentParams) {
    const id = `pi_mock_${randomBytes(8).toString('hex')}`;
    this.intents.set(id, { id, status: 'requires_payment_method', amountCents, currency: CURRENCY, metadata });
    return { id, clientSecret: `${id}_secret_${randomBytes(8).toString('hex')}` };
  }

  async retrieveIntent(id: string) {
    return this.intents.get(id) ?? null;
  }

  markSucceeded(id: string): boolean {
    const intent = this.intents.get(id);
    if (!intent) return false;
    intent.status = 'succeeded';
    return true;
  }
}

export function gatewayFromEnv(env: NodeJS.ProcessEnv = process.env): PaymentGateway {
  const secret = env.STRIPE_SECRET_KEY;
  const publishable = env.STRIPE_PUBLISHABLE_KEY;
  if (secret && publishable) return new StripeGateway(secret, publishable);
  return new MockGateway();
}
