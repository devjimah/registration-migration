export interface RegistrationValues {
  name: string;
  email: string;
  password: string;
  confirm: string;
  plan: string;
}

export type FieldName = keyof RegistrationValues | 'form';
export type FieldErrors = Partial<Record<FieldName, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string | undefined): boolean {
  return EMAIL_RE.test(value ?? '');
}

export function validate(values: RegistrationValues): FieldErrors {
  const errors: FieldErrors = {};

  if (values.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }
  if (!isEmail(values.email)) {
    errors.email = 'Enter a valid email address';
  }
  if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  if (values.confirm !== values.password) {
    errors.confirm = 'Passwords do not match';
  }
  if (!values.plan) {
    errors.plan = 'Choose a plan';
  }

  return errors;
}
