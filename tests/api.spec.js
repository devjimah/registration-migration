// @ts-check
// Contract tests against the Express API directly (no browser).
const { test, expect } = require('@playwright/test');

const uniqueEmail = () => `api-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

test('GET /api/plans lists the plans', async ({ request }) => {
  const res = await request.get('/api/plans');
  expect(res.ok()).toBe(true);
  const { plans } = await res.json();
  expect(plans.map((p) => p.id)).toEqual(['free', 'pro', 'team']);
});

test('POST /api/check-email rejects malformed emails', async ({ request }) => {
  const res = await request.post('/api/check-email', { data: { email: 'nope' } });
  expect(res.status()).toBe(400);
});

test('POST /api/register returns 201 and a normalised user', async ({ request }) => {
  const email = uniqueEmail();
  const res = await request.post('/api/register', {
    data: { name: '  Grace Hopper ', email: email.toUpperCase(), password: 'cobol-1959', plan: 'pro' }
  });
  expect(res.status()).toBe(201);
  const { user } = await res.json();
  expect(user).toMatchObject({ name: 'Grace Hopper', email, plan: 'pro' });
  expect(user).not.toHaveProperty('password');
});

test('POST /api/register rejects wrongly typed fields with 422', async ({ request }) => {
  const res = await request.post('/api/register', {
    data: { name: 12345, email: ['a@b.co'], password: 123456789, plan: 'enterprise' }
  });
  expect(res.status()).toBe(422);
  const { errors } = await res.json();
  expect(Object.keys(errors).sort()).toEqual(['email', 'name', 'password', 'plan']);
});

test('POST /api/register rejects duplicate emails case-insensitively', async ({ request }) => {
  const res = await request.post('/api/register', {
    data: { name: 'Dup', email: 'TAKEN@example.com', password: 'password123', plan: 'free' }
  });
  expect(res.status()).toBe(422);
  expect((await res.json()).errors.email).toBe('An account with this email already exists');
});
