import $ from 'jquery';

export interface Plan {
  id: string;
  name: string;
  priceCents: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  plan: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  plan: string;
}

// Still returns jqXHR (not native Promises) because legacy/registration.js
// chains .done/.fail/.always and reads xhr.responseJSON. Switch to fetch once
// that consumer is migrated.
function postJSON<T>(url: string, data: unknown): JQuery.jqXHR<T> {
  return $.ajax({
    url,
    method: 'POST',
    contentType: 'application/json',
    dataType: 'json',
    data: JSON.stringify(data)
  });
}

export function getPlans(): JQuery.jqXHR<{ plans: Plan[] }> {
  return $.getJSON('/api/plans');
}

export function checkEmail(email: string): JQuery.jqXHR<{ available: boolean }> {
  return postJSON('/api/check-email', { email });
}

export function register(payload: RegisterPayload): JQuery.jqXHR<{ user: User }> {
  return postJSON('/api/register', payload);
}
