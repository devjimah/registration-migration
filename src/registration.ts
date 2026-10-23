import $ from 'jquery';
import { ApiError, checkEmail, getPlans, register } from './api';
import { isEmail, validate, type FieldErrors, type RegistrationValues } from './validation';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

function formatPrice(cents: number): string {
  return cents === 0 ? 'Free' : `$${(cents / 100).toFixed(2)}/mo`;
}

function readValues($form: JQuery<HTMLFormElement>): RegistrationValues {
  const values: RegistrationValues = { name: '', email: '', password: '', confirm: '', plan: '' };
  for (const { name, value } of $form.serializeArray()) {
    if (name in values) values[name as keyof RegistrationValues] = value;
  }
  return values;
}

function showErrors($form: JQuery<HTMLFormElement>, errors: FieldErrors): void {
  $form.find('.error').text('');
  $form.find('input, select').removeClass('invalid');
  for (const [field, message] of Object.entries(errors)) {
    $form.find(`[data-error-for="${field}"]`).text(message ?? '');
    $form.find(`[name="${field}"]`).addClass('invalid');
  }
}

/** Pulls field errors out of a 422 body; anything else becomes a generic form error. */
function errorsFrom(err: unknown): FieldErrors {
  if (err instanceof ApiError && err.body && typeof err.body === 'object' && 'errors' in err.body) {
    return (err.body as { errors: FieldErrors }).errors;
  }
  return { form: GENERIC_ERROR };
}

async function loadPlans(): Promise<void> {
  const $plan = $<HTMLSelectElement>('#plan');
  const { plans } = await getPlans();
  $plan.empty().append($('<option>', { value: '', text: 'Select a plan' }));
  for (const plan of plans) {
    $plan.append($('<option>', { value: plan.id, text: `${plan.name} — ${formatPrice(plan.priceCents)}` }));
  }
}

function bindEmailCheck($form: JQuery<HTMLFormElement>): void {
  $form.find<HTMLInputElement>('#email').on('blur', async (e) => {
    const email = e.currentTarget.value;
    if (!isEmail(email)) return;
    try {
      const { available } = await checkEmail(email);
      if (!available) showErrors($form, { email: 'An account with this email already exists' });
    } catch {
      // Availability is re-checked on submit; a failed pre-check is not worth surfacing.
    }
  });
}

function bindSubmit($form: JQuery<HTMLFormElement>): void {
  const $submit = $<HTMLButtonElement>('#submit');

  $form.on('submit', async (e) => {
    e.preventDefault();
    const values = readValues($form);
    const errors = validate(values);
    showErrors($form, errors);
    if (Object.keys(errors).length) return;

    $submit.prop('disabled', true).text('Creating account…');
    try {
      const { user } = await register({
        name: values.name,
        email: values.email,
        password: values.password,
        plan: values.plan
      });
      $form.prop('hidden', true);
      $('#success-message').text(`Your account for ${user.email} is ready.`);
      $('#success').prop('hidden', false);
    } catch (err) {
      showErrors($form, errorsFrom(err));
    } finally {
      $submit.prop('disabled', false).text('Create account');
    }
  });
}

export function initRegistration(): void {
  const $form = $<HTMLFormElement>('#registration-form');
  void loadPlans();
  bindEmailCheck($form);
  bindSubmit($form);
}
