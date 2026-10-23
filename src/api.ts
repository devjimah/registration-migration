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

/** Non-2xx response. `body` is the parsed JSON body, or null if it wasn't JSON. */
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

function postJSON<T>(url: string, data: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export function getPlans(): Promise<{ plans: Plan[] }> {
  return request('/api/plans');
}

export function checkEmail(email: string): Promise<{ available: boolean }> {
  return postJSON('/api/check-email', { email });
}

export function register(payload: RegisterPayload): Promise<{ user: User }> {
  return postJSON('/api/register', payload);
}
