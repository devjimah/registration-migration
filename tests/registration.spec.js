// @ts-check
// Behavioural contract for the registration flow. These tests are deliberately
// implementation-agnostic (they only touch the DOM and network), so the same
// suite must stay green at every migration stage.
const { test, expect } = require('@playwright/test');

const uniqueEmail = () => `user-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

async function fillAccount(page, overrides = {}) {
  const values = {
    name: 'Ada Lovelace',
    email: uniqueEmail(),
    password: 'correct-horse',
    confirm: 'correct-horse',
    ...overrides
  };
  await page.fill('#name', values.name);
  await page.fill('#email', values.email);
  await page.fill('#password', values.password);
  await page.fill('#confirm', values.confirm);
  return values;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Plans are loaded from the API; wait until the select is populated.
  await expect(page.locator('#plan option[value="free"]')).toHaveCount(1);
});

test('loads plans from the API', async ({ page }) => {
  await expect(page.locator('#plan option')).toHaveText([
    'Select a plan',
    'Free — Free',
    'Pro — $12.00/mo',
    'Team — $49.00/mo'
  ]);
});

test('shows client-side validation errors without calling the API', async ({ page }) => {
  let registerCalled = false;
  page.on('request', (req) => {
    if (req.url().endsWith('/api/register')) registerCalled = true;
  });

  await fillAccount(page, { name: 'A', email: 'not-an-email', password: 'short', confirm: 'different' });
  await page.click('#submit');

  await expect(page.locator('[data-error-for="name"]')).toHaveText('Name must be at least 2 characters');
  await expect(page.locator('[data-error-for="email"]')).toHaveText('Enter a valid email address');
  await expect(page.locator('[data-error-for="password"]')).toHaveText('Password must be at least 8 characters');
  await expect(page.locator('[data-error-for="confirm"]')).toHaveText('Passwords do not match');
  await expect(page.locator('[data-error-for="plan"]')).toHaveText('Choose a plan');
  await expect(page.locator('#name')).toHaveClass(/invalid/);
  expect(registerCalled).toBe(false);
});

test('flags an email that is already registered on blur', async ({ page }) => {
  await page.fill('#email', 'taken@example.com');
  await page.locator('#email').blur();
  await expect(page.locator('[data-error-for="email"]')).toHaveText('An account with this email already exists');
});

test('registers a new account on the free plan', async ({ page }) => {
  const { email } = await fillAccount(page);
  await page.selectOption('#plan', 'free');
  await page.click('#submit');

  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#success-message')).toHaveText(`Your account for ${email} is ready.`);
  await expect(page.locator('#registration-form')).toBeHidden();
});

test('shows server-side errors returned by the API', async ({ page }) => {
  await fillAccount(page, { email: 'taken@example.com' });
  await page.selectOption('#plan', 'free');
  await page.click('#submit');

  await expect(page.locator('[data-error-for="email"]')).toHaveText('An account with this email already exists');
  await expect(page.locator('#success')).toBeHidden();
});

test('shows a generic error when the server fails', async ({ page }) => {
  await page.route('**/api/register', (route) => route.fulfill({ status: 500, body: 'boom' }));
  await fillAccount(page);
  await page.selectOption('#plan', 'free');
  await page.click('#submit');

  await expect(page.locator('[data-error-for="form"]')).toHaveText('Something went wrong. Please try again.');
  await expect(page.locator('#submit')).toBeEnabled();
});
