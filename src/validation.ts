import type { FieldErrors, RegisterRequest } from '../shared/contracts';
import { validateRegistration } from '../shared/validation';

export { isEmail } from '../shared/validation';

/** Raw form values: everything is a string, and `confirm` never leaves the browser. */
export interface RegistrationValues {
  name: string;
  email: string;
  password: string;
  confirm: string;
  plan: string;
}

export type FormErrors = FieldErrors<keyof RegistrationValues | 'payment'>;

export function validateForm(
  values: RegistrationValues
): { ok: true; request: RegisterRequest } | { ok: false; errors: FormErrors } {
  const result = validateRegistration(values);
  const errors: FormErrors = result.ok ? {} : { ...result.errors };

  if (values.confirm !== values.password) {
    errors.confirm = 'Passwords do not match';
  }

  if (result.ok && !errors.confirm) return { ok: true, request: result.value };
  return { ok: false, errors };
}
