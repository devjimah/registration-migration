// HTTP contract between the browser bundle and the Express API.
// Imported by both src/ and server/, so a breaking change fails type-checking on both sides.

export const ROUTES = {
  config: '/api/config',
  plans: '/api/plans',
  paymentIntents: '/api/payment-intents',
  checkEmail: '/api/check-email',
  register: '/api/register'
} as const;

export const PLAN_IDS = ['free', 'pro', 'team'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const CURRENCY = 'usd';

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as readonly string[]).includes(value);
}

export interface Plan {
  id: PlanId;
  name: string;
  priceCents: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  plan: PlanId;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  plan: PlanId;
  /** Required for paid plans: a PaymentIntent the browser has already confirmed. */
  paymentIntentId?: string;
}

export type RegisterField = 'name' | 'email' | 'password' | 'plan' | 'payment';

/** Field-keyed error messages; `form` is for errors not tied to one field. */
export type FieldErrors<F extends string = RegisterField> = Partial<Record<F | 'form', string>>;

// GET /api/config
export interface ConfigResponse {
  stripePublishableKey: string;
  /** Set only in mock mode: a fake Stripe.js to load instead of js.stripe.com. */
  stripeJsOverride?: string;
}

// GET /api/plans
export interface PlansResponse {
  plans: Plan[];
}

// POST /api/check-email
export interface CheckEmailRequest {
  email: string;
}
export interface CheckEmailResponse {
  available: boolean;
}

// POST /api/payment-intents -> 201 CreatePaymentIntentResponse | 422 ValidationErrorResponse
// Validates the account details *before* any money moves, then creates the intent.
export type CreatePaymentIntentRequest = Pick<RegisterRequest, 'name' | 'email' | 'plan'>;
export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
}

// POST /api/register -> 201 RegisterResponse | 422 ValidationErrorResponse
export interface RegisterResponse {
  user: User;
}
export interface ValidationErrorResponse {
  errors: FieldErrors;
}

// Any 4xx not covered above
export interface ErrorResponse {
  error: string;
}
