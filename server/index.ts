import { createApp } from './app';
import { gatewayFromEnv } from './payments';

const PORT = Number(process.env.PORT ?? 3000);
const gateway = gatewayFromEnv();

createApp({ gateway }).listen(PORT, () => {
  console.log(`Registration server listening on http://localhost:${PORT}`);
  if (gateway.kind === 'mock') {
    console.log('Payments: MOCK gateway (set STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY in .env for Stripe test mode)');
  }
});
