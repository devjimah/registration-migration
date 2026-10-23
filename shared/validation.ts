// Validation rules shared by the browser (fast feedback) and the server (authority).
import {
  isPlanId,
  type CreatePaymentIntentRequest,
  type FieldErrors,
  type RegisterRequest
} from './contracts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MESSAGES = {
  name: 'Name must be at least 2 characters',
  email: 'Enter a valid email address',
  emailTaken: 'An account with this email already exists',
  password: 'Password must be at least 8 characters',
  plan: 'Choose a plan',
  paymentRequired: 'Payment is required for this plan',
  paymentInvalid: 'We could not verify your payment. Please try again.'
} as const;

type Untrusted<T> = Partial<Record<keyof T, unknown>>;
type Result<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value);
}

/** Name, email and plan: everything needed before a payment is started. */
export function validateAccount(input: Untrusted<CreatePaymentIntentRequest>): Result<CreatePaymentIntentRequest> {
  const { name, email, plan } = input;
  const errors: FieldErrors = {};

  if (typeof name !== 'string' || name.trim().length < 2) errors.name = MESSAGES.name;
  if (!isEmail(email)) errors.email = MESSAGES.email;
  if (!isPlanId(plan)) errors.plan = MESSAGES.plan;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name: (name as string).trim(), email: (email as string).trim(), plan: plan as RegisterRequest['plan'] } };
}

/** Full registration payload. Accepts untrusted input (e.g. a JSON body) and narrows it on success. */
export function validateRegistration(input: Untrusted<RegisterRequest>): Result<RegisterRequest> {
  const account = validateAccount(input);
  const { password, paymentIntentId } = input;
  const errors: FieldErrors = account.ok ? {} : { ...account.errors };

  if (typeof password !== 'string' || password.length < 8) errors.password = MESSAGES.password;
  if (paymentIntentId !== undefined && typeof paymentIntentId !== 'string') errors.payment = MESSAGES.paymentInvalid;

  if (!account.ok || Object.keys(errors).length) return { ok: false, errors };
  const value: RegisterRequest = { ...account.value, password: password as string };
  if (typeof paymentIntentId === 'string') value.paymentIntentId = paymentIntentId;
  return { ok: true, value };
}
