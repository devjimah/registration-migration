# registration-migration

A registration form migrated in stages from global jQuery + IIFE scripts to a typed
TypeScript app bundled with esbuild. It talks to an Express API, takes payments for
paid plans with Stripe's Payment Element, and is covered by Playwright end-to-end tests.

Each stage is one commit (`git log --oneline`), and the browser suite in
`tests/registration.spec.js` passes unchanged at every stage. That suite is the safety
net for the migration.

## Quick start

```sh
npm install
npx playwright install chromium
npm run build && npm start      # http://localhost:3000
npm test                        # type-check + Playwright
```

Without Stripe keys the server uses a **mock payment gateway** and serves a fake
Stripe.js (card `4242 4242 4242 4242` succeeds and `4000 0000 0000 0002` is declined).
To use Stripe test mode, copy `.env.example` to `.env` and fill in your
`sk_test_…` and `pk_test_…` keys.

Development: run `npm run watch` (rebuilds the browser bundle) and `npm run dev:server`
(restarts the API on change) in two terminals.

## The stages

| Commit | What changed | Why it's safe |
|---|---|---|
| **0** Legacy | `public/js/*.js` IIFEs share `window.RegApp` and load in `<script>` order after global jQuery. | Playwright suite written against DOM and network behaviour only. |
| **1** esbuild | Files moved unchanged to `src/legacy/`. `src/main.js` imports them in the old order. jQuery comes from npm. | No code edits, so the same tests pass. |
| **2a** TS + validation | `tsconfig` set to `strict` + `allowJs`. `validation.ts` becomes a typed module. A temporary `legacy-bridge.ts` puts it back on `window.RegApp` for the remaining IIFEs. | JS and TS coexist, and each file is converted on its own. |
| **2b** API client | `api.ts` is typed but still returns `jqXHR`, because the legacy consumer chains `.done/.fail`. | Return type unchanged for the old caller. |
| **2c** Controller | `registration.ts` replaces the last IIFE. `api.ts` moves to `fetch` with async/await. Bridge, globals and `allowJs` are removed. | Last consumer migrated, so the compatibility layer can go. |
| **3** Shared contracts | `shared/contracts.ts` (routes and request/response types) and `shared/validation.ts` are imported by both the client and the TypeScript server. Server built by esbuild into `dist/server.cjs`. | A contract change breaks `tsc` on both sides. `tests/api.spec.js` covers bad input. |
| **4** Stripe | Paid plans show the Payment Element. The server verifies each PaymentIntent before creating the account. | `tests/payments.spec.js` covers the UI and API, and a mock gateway keeps tests offline. |

## Layout

```
shared/        contracts.ts, validation.ts      used by client and server
src/           main.ts → registration.ts (jQuery DOM), api.ts (fetch), payments.ts (Stripe)
server/        index.ts → app.ts (routes), payments.ts (Stripe | Mock gateway), mock/fake-stripe.js
public/        index.html, css/, dist/ (build output)
tests/         registration.spec.js (UI, every stage), api.spec.js, payments.spec.js
build.mjs      esbuild: browser IIFE bundle + Node server bundle
```

## Payment flow (paid plans)

1. The browser runs `elements.submit()`, which validates the card before any server call.
2. `POST /api/payment-intents` re-validates name, email and plan, rejects emails that are
   already registered, and creates a PaymentIntent with `{plan, email}` metadata.
3. The browser calls `stripe.confirmPayment({ redirect: 'if_required' })`. Redirect-based
   payment methods are disabled, so confirmation always happens on the page. After a
   decline, the retry reuses the same intent.
4. `POST /api/register` with `paymentIntentId`. The server fetches the intent from Stripe
   and requires `status === 'succeeded'`, the right amount and currency, matching plan
   and email metadata, and that the intent hasn't been used before.

## Known gaps before production

- **Storage is in memory.** Users and used intents are lost on restart. Use a database
  with a unique index on the email and on the PaymentIntent id.
- **Payment can succeed while registration fails** (for example, a duplicate-email race
  between steps 2 and 4, or the tab closing after step 3). Add a
  `payment_intent.succeeded` webhook that creates or reconciles the account, or refunds
  the payment.
- **"/mo" plans are charged once.** This uses one-off PaymentIntents. Real recurring
  billing needs Stripe Customers + Subscriptions (Elements `mode: 'subscription'`).
- **The real Stripe path isn't covered by the tests.** Playwright always runs against the
  mock gateway. Before shipping, try it by hand with test keys, or add a separate CI job
  with test keys.
- No rate limiting or CSRF protection, and passwords are validated but never stored.
  Hash them (argon2/bcrypt) when you add persistence.
