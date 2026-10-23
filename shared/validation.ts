// Validation rules shared by the browser (fast feedback) and the server (authority).
import { isPlanId, type FieldErrors, type RegisterRequest } from './contracts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MESSAGES = {
  name: 'Name must be at least 2 characters',
  email: 'Enter a valid email address',
  emailTaken: 'An account with this email already exists',
  password: 'Password must be at least 8 characters',
  plan: 'Choose a plan'
} as const;

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value);
}

/** Accepts untrusted input (e.g. a JSON body) and narrows it on success. */
export function validateRegistration(
  input: Partial<Record<keyof RegisterRequest, unknown>>
): { ok: true; value: RegisterRequest } | { ok: false; errors: FieldErrors } {
  const { name, email, password, plan } = input;
  const errors: FieldErrors = {};

  if (typeof name !== 'string' || name.trim().length < 2) errors.name = MESSAGES.name;
  if (!isEmail(email)) errors.email = MESSAGES.email;
  if (typeof password !== 'string' || password.length < 8) errors.password = MESSAGES.password;
  if (!isPlanId(plan)) errors.plan = MESSAGES.plan;

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { name: (name as string).trim(), email: (email as string).trim(), password: password as string, plan: plan as RegisterRequest['plan'] }
  };
}
