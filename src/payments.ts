// '/pure' defers injecting Stripe.js until loadStripe() is called, so free-plan
// visitors never download it.
import { loadStripe } from '@stripe/stripe-js/pure';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import { CURRENCY, type CreatePaymentIntentRequest } from '../shared/contracts';
import { createPaymentIntent, getConfig } from './api';

/** A payment problem to show next to the card field (declined, incomplete, …). */
export class PaymentError extends Error {
  name = 'PaymentError';
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function initStripe(): Promise<Stripe> {
  const config = await getConfig();
  // Without real keys the server provides a fake Stripe.js. loadStripe() reuses an
  // existing window.Stripe instead of fetching js.stripe.com.
  if (config.stripeJsOverride) await loadScript(config.stripeJsOverride);
  const stripe = await loadStripe(config.stripePublishableKey);
  if (!stripe) throw new Error('Stripe.js failed to initialise');
  return stripe;
}

/** Owns the Stripe Payment Element for the paid-plan step of the form. */
export class PaymentStep {
  private ready: Promise<{ stripe: Stripe; elements: StripeElements }> | null = null;
  // Reused when the customer retries after a decline, so retries don't leave orphaned intents.
  private intent: { key: string; clientSecret: string } | null = null;

  constructor(private readonly mountSelector: string) {}

  /** Mounts the Payment Element on first use; re-prices it when the plan changes. */
  async show(amountCents: number): Promise<void> {
    if (this.ready) {
      (await this.ready).elements.update({ amount: amountCents });
      return;
    }
    this.ready = initStripe().then((stripe) => {
      // Deferred-intent mode: render the card form now, create the PaymentIntent on submit.
      const elements = stripe.elements({ mode: 'payment', amount: amountCents, currency: CURRENCY, allowedPaymentMethodTypes: ['card'] });
      elements.create('payment').mount(this.mountSelector);
      return { stripe, elements };
    });
    this.ready.catch(() => (this.ready = null));
    await this.ready;
  }

  /**
   * Validates the card, creates the PaymentIntent on the server, then confirms it in-page.
   * Resolves with the confirmed PaymentIntent id. Rejects with PaymentError for card problems,
   * or ApiError if the server refuses to create the intent (e.g. email already registered).
   */
  async pay(details: CreatePaymentIntentRequest): Promise<string> {
    if (!this.ready) throw new PaymentError('Payment form is not ready yet.');
    const { stripe, elements } = await this.ready;

    const { error: submitError } = await elements.submit();
    if (submitError) throw new PaymentError(submitError.message ?? 'Check your card details.');

    const key = `${details.plan}:${details.email.toLowerCase()}`;
    if (this.intent?.key !== key) {
      const { clientSecret } = await createPaymentIntent(details);
      this.intent = { key, clientSecret };
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: this.intent.clientSecret,
      confirmParams: {
        return_url: window.location.href,
        payment_method_data: { billing_details: { name: details.name, email: details.email } }
      },
      redirect: 'if_required'
    });
    if (error) throw new PaymentError(error.message ?? 'Your payment could not be completed.');
    if (paymentIntent.status !== 'succeeded') {
      throw new PaymentError('Your payment is still processing. Please try again in a moment.');
    }
    this.intent = null;
    return paymentIntent.id;
  }
}
