// @ts-check
// Paid-plan flow. The server runs with the mock gateway (see playwright.config.js),
// which serves a fake Stripe.js; the test cards mirror Stripe's.
const { test, expect } = require('@playwright/test');

const SUCCESS_CARD = '4242 4242 4242 4242';
const DECLINED_CARD = '4000 0000 0000 0002';
const uniqueEmail = () => `pay-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

test.describe('UI', () => {
  test.beforeEach(async ({ page }) => {
    // Mock mode must never reach the real Stripe CDN.
    await page.route('https://js.stripe.com/**', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('#plan option[value="pro"]')).toHaveCount(1);
  });

  async function fillAccount(page, plan = 'pro') {
    const email = uniqueEmail();
    await page.fill('#name', 'Katherine Johnson');
    await page.fill('#email', email);
    await page.fill('#password', 'trajectory-62');
    await page.fill('#confirm', 'trajectory-62');
    await page.selectOption('#plan', plan);
    return email;
  }

  const card = (page) => page.locator('#payment-element').getByLabel('Card number');

  test('only shows the payment step for paid plans', async ({ page }) => {
    await expect(page.locator('#payment-section')).toBeHidden();
    await page.selectOption('#plan', 'team');
    await expect(page.locator('#payment-section')).toBeVisible();
    await expect(card(page)).toBeVisible();
    await page.selectOption('#plan', 'free');
    await expect(page.locator('#payment-section')).toBeHidden();
  });

  test('pays and registers on the Pro plan', async ({ page }) => {
    const email = await fillAccount(page);
    await card(page).fill(SUCCESS_CARD);

    const registerReq = page.waitForRequest('**/api/register');
    await page.click('#submit');

    const body = (await registerReq).postDataJSON();
    expect(body.paymentIntentId).toMatch(/^pi_/);
    await expect(page.locator('#success-message')).toHaveText(`Your account for ${email} is ready.`);
  });

  test('rejects an incomplete card before creating a PaymentIntent', async ({ page }) => {
    let intentCreated = false;
    page.on('request', (req) => {
      if (req.url().endsWith('/api/payment-intents')) intentCreated = true;
    });
    await fillAccount(page);
    await card(page).fill('4242');
    await page.click('#submit');

    await expect(page.locator('[data-error-for="payment"]')).toHaveText('Your card number is incomplete.');
    expect(intentCreated).toBe(false);
  });

  test('shows a decline, then succeeds on retry reusing the same PaymentIntent', async ({ page }) => {
    const intentRequests = [];
    page.on('request', (req) => {
      if (req.url().endsWith('/api/payment-intents')) intentRequests.push(req);
    });

    const email = await fillAccount(page);
    await card(page).fill(DECLINED_CARD);
    await page.click('#submit');
    await expect(page.locator('[data-error-for="payment"]')).toHaveText('Your card was declined.');
    await expect(page.locator('#submit')).toBeEnabled();

    await card(page).fill(SUCCESS_CARD);
    await page.click('#submit');
    await expect(page.locator('#success-message')).toHaveText(`Your account for ${email} is ready.`);
    expect(intentRequests).toHaveLength(1);
  });

  test('does not start a payment for an email that is already registered', async ({ page }) => {
    await fillAccount(page);
    await page.fill('#email', 'taken@example.com');
    await card(page).fill(SUCCESS_CARD);
    await page.click('#submit');

    await expect(page.locator('[data-error-for="email"]')).toHaveText('An account with this email already exists');
    await expect(page.locator('#success')).toBeHidden();
  });
});

test.describe('API', () => {
  const account = (plan = 'pro') => ({ name: 'Alan Turing', email: uniqueEmail(), password: 'enigma-1940', plan });

  async function paidIntent(request, details) {
    const res = await request.post('/api/payment-intents', { data: details });
    expect(res.status()).toBe(201);
    const { paymentIntentId } = await res.json();
    expect((await request.post(`/api/__mock/payment-intents/${paymentIntentId}/succeed`)).status()).toBe(204);
    return paymentIntentId;
  }

  test('paid plans require a paymentIntentId', async ({ request }) => {
    const res = await request.post('/api/register', { data: account() });
    expect(res.status()).toBe(422);
    expect((await res.json()).errors.payment).toBe('Payment is required for this plan');
  });

  test('rejects an intent that was never confirmed', async ({ request }) => {
    const details = account();
    const { paymentIntentId } = await (await request.post('/api/payment-intents', { data: details })).json();
    const res = await request.post('/api/register', { data: { ...details, paymentIntentId } });
    expect(res.status()).toBe(422);
    expect((await res.json()).errors).toHaveProperty('payment');
  });

  test('rejects an intent paid for a cheaper plan', async ({ request }) => {
    const details = account('pro');
    const paymentIntentId = await paidIntent(request, details);
    const res = await request.post('/api/register', { data: { ...details, plan: 'team', paymentIntentId } });
    expect(res.status()).toBe(422);
  });

  test('rejects an intent paid by a different customer', async ({ request }) => {
    const paymentIntentId = await paidIntent(request, account());
    const res = await request.post('/api/register', { data: { ...account(), paymentIntentId } });
    expect(res.status()).toBe(422);
  });

  test('a PaymentIntent can only be used once', async ({ request }) => {
    const details = account();
    const paymentIntentId = await paidIntent(request, details);
    expect((await request.post('/api/register', { data: { ...details, paymentIntentId } })).status()).toBe(201);

    // Same intent, same email but different case: blocked as duplicate either way.
    const again = await request.post('/api/register', { data: { ...details, email: details.email.toUpperCase(), paymentIntentId } });
    expect(again.status()).toBe(422);
  });

  test('will not create intents for the free plan or taken emails', async ({ request }) => {
    expect((await request.post('/api/payment-intents', { data: account('free') })).status()).toBe(422);
    const taken = await request.post('/api/payment-intents', { data: { ...account(), email: 'taken@example.com' } });
    expect((await taken.json()).errors.email).toBe('An account with this email already exists');
  });
});
