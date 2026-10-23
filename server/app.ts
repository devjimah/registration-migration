import path from 'node:path';
import express, { type Request, type Response } from 'express';
import {
  ROUTES,
  type CheckEmailRequest,
  type CheckEmailResponse,
  type ErrorResponse,
  type Plan,
  type PlansResponse,
  type RegisterRequest,
  type RegisterResponse,
  type User,
  type ValidationErrorResponse
} from '../shared/contracts';
import { isEmail, MESSAGES, validateRegistration } from '../shared/validation';

const PLANS: Plan[] = [
  { id: 'free', name: 'Free', priceCents: 0 },
  { id: 'pro', name: 'Pro', priceCents: 1200 },
  { id: 'team', name: 'Team', priceCents: 4900 }
];

// Untrusted JSON body: every field may be missing or the wrong type.
type Untrusted<T> = Partial<Record<keyof T, unknown>>;

export function createApp(staticDir = path.resolve('public')) {
  const app = express();

  // In-memory "database". Seeded with one account so the duplicate-email path is testable.
  const users: User[] = [{ id: 1, name: 'Existing User', email: 'taken@example.com', plan: 'free' }];
  const findUser = (email: string) => users.find((u) => u.email === email.trim().toLowerCase());

  app.use(express.json());
  app.use(express.static(staticDir));

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
    ROUTES.register,
    (req: Request<{}, {}, Untrusted<RegisterRequest>>, res: Response<RegisterResponse | ValidationErrorResponse>) => {
      const result = validateRegistration(req.body ?? {});
      if (!result.ok) {
        res.status(422).json({ errors: result.errors });
        return;
      }
      const { name, email, plan } = result.value;
      if (findUser(email)) {
        res.status(422).json({ errors: { email: MESSAGES.emailTaken } });
        return;
      }

      const user: User = { id: users.length + 1, name, email: email.toLowerCase(), plan };
      users.push(user);
      res.status(201).json({ user });
    }
  );

  return app;
}
