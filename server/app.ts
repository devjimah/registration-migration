import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  CURRENCY,
  ROUTES,
  type CheckEmailRequest,
  type CheckEmailResponse,
  type ConfigResponse,
  type CreatePaymentIntentRequest,
  type CreatePaymentIntentResponse,
  type ErrorResponse,
  type Plan,
  type PlansResponse,
  type RegisterRequest,
  type RegisterResponse,
  type User,
  type ValidationErrorResponse
} from '../shared/contracts';
import { isEmail, MESSAGES, validateAccount, validateRegistration } from '../shared/validation';
import { MockGateway, type PaymentGateway } from './payments';

const PLANS: Plan[] = [
  { id: 'free', name: 'Free', priceCents: 0 },
  { id: 'pro', name: 'Pro', priceCents: 1200 },
  { id: 'team', name: 'Team', priceCents: 4900 }
];

const MOCK_STRIPE_JS = '/api/__mock/stripe.js';

// Untrusted JSON body: every field may be missing or the wrong type.
type Untrusted<T> = Partial<Record<keyof T, unknown>>;

export interface AppOptions {
  gateway: PaymentGateway;
  staticDir?: string;
}

export function createApp({ gateway, staticDir = path.resolve('public') }: AppOptions) {
  const app = express();

  // In-memory "database". Seeded with one account so the duplicate-email path is testable.
  const users: User[] = [{ id: 1, name: 'Existing User', email: 'taken@example.com', plan: 'free' }];
  const findUser = (email: string) => users.find((u) => u.email === email.trim().toLowerCase());
  const priceOf = (planId: Plan['id']) => PLANS.find((p) => p.id === planId)!.priceCents;
  // A confirmed PaymentIntent pays for exactly one account.
  const consumedIntents = new Set<string>();

  app.use(express.json());
  app.use(express.static(staticDir));

  app.get(ROUTES.config, (_req, res: Response<ConfigResponse>) => {
    res.json({
      stripePublishableKey: gateway.publishableKey,
      ...(gateway instanceof MockGateway && { stripeJsOverride: MOCK_STRIPE_JS })
    });
  });

  app.get(ROUTES.plans, (_req, res: Response<PlansResponse>) => {
    res.json({ plans: PLANS });
  });

  app.post(
    ROUTES.checkEmail,
    (req: Request<{}, {}, Untrusted<CheckEmailRequest>>, res: Response<CheckEmailResponse | ErrorResponse>) => {
      const { email } = req.body ?? {};
      if (!isEmail(email)) {
        res.status(400).json({ error: 'Invalid email' });
        return;
      }
      res.json({ available: !findUser(email) });
    }
  );

  app.post(
    ROUTES.paymentIntents,
    async (
      req: Request<{}, {}, Untrusted<CreatePaymentIntentRequest>>,
      res: Response<CreatePaymentIntentResponse | ValidationErrorResponse>,
      next: NextFunction
    ) => {
      try {
        // Reject bad account details before the customer enters a card and is charged.
        const result = validateAccount(req.body ?? {});
        if (!result.ok) {
          res.status(422).json({ errors: result.errors });
          return;
        }
        const { email, plan } = result.value;
        if (findUser(email)) {
          res.status(422).json({ errors: { email: MESSAGES.emailTaken } });
          return;
        }
        const amountCents = priceOf(plan);
        if (amountCents === 0) {
          res.status(422).json({ errors: { plan: 'The free plan does not need a payment' } });
          return;
        }

        const intent = await gateway.createIntent({
          amountCents,
          email,
          metadata: { plan, email: email.toLowerCase() }
        });
        res.status(201).json({ paymentIntentId: intent.id, clientSecret: intent.clientSecret });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    ROUTES.register,
    async (
      req: Request<{}, {}, Untrusted<RegisterRequest>>,
      res: Response<RegisterResponse | ValidationErrorResponse>,
      next: NextFunction
    ) => {
      try {
        const result = validateRegistration(req.body ?? {});
        if (!result.ok) {
          res.status(422).json({ errors: result.errors });
          return;
        }
        const { name, plan, paymentIntentId } = result.value;
        const email = result.value.email.toLowerCase();
        if (findUser(email)) {
          res.status(422).json({ errors: { email: MESSAGES.emailTaken } });
          return;
        }

        const amountCents = priceOf(plan);
        if (amountCents > 0) {
          if (!paymentIntentId) {
            res.status(422).json({ errors: { payment: MESSAGES.paymentRequired } });
            return;
          }
          // Never trust the browser's word that it paid: re-read the intent from the gateway
          // and check it was for this plan, this customer, the right amount, and is unused.
          const intent = consumedIntents.has(paymentIntentId) ? null : await gateway.retrieveIntent(paymentIntentId);
          const valid =
            intent !== null &&
            intent.status === 'succeeded' &&
            intent.amountCents === amountCents &&
            intent.currency === CURRENCY &&
            intent.metadata.plan === plan &&
            intent.metadata.email === email;
          if (!valid) {
            res.status(422).json({ errors: { payment: MESSAGES.paymentInvalid } });
            return;
          }
          consumedIntents.add(paymentIntentId);
        }

        const user: User = { id: users.length + 1, name, email, plan };
        users.push(user);
        res.status(201).json({ user });
      } catch (err) {
        next(err);
      }
    }
  );

  // Mock mode only: serve the fake Stripe.js and let it "confirm" payments.
  if (gateway instanceof MockGateway) {
    app.get(MOCK_STRIPE_JS, (_req, res) => {
      res.sendFile(path.resolve('server/mock/fake-stripe.js'));
    });
    app.post('/api/__mock/payment-intents/:id/succeed', (req: Request<{ id: string }>, res: Response) => {
      res.sendStatus(gateway.markSucceeded(req.params.id) ? 204 : 404);
    });
  }

  app.use((err: unknown, _req: Request, res: Response<ErrorResponse>, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
