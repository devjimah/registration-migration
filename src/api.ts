import {
  ROUTES,
  type CheckEmailRequest,
  type CheckEmailResponse,
  type PlansResponse,
  type RegisterRequest,
  type RegisterResponse,
  type ValidationErrorResponse
} from '../shared/contracts';

/** Non-2xx response. `body` is the parsed JSON body, or null if it wasn't JSON. */
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`Request failed with status ${status}`);
    this.name = 'ApiError';
  }

  /** True for a 422 carrying field errors, as defined by the shared contract. */
  isValidationError(): this is ApiError & { body: ValidationErrorResponse } {
    return (
      this.status === 422 &&
      typeof this.body === 'object' &&
      this.body !== null &&
      typeof (this.body as ValidationErrorResponse).errors === 'object'
    );
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

function postJSON<Req, Res>(url: string, data: Req): Promise<Res> {
  return request<Res>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export function getPlans(): Promise<PlansResponse> {
  return request(ROUTES.plans);
}

export function checkEmail(email: string): Promise<CheckEmailResponse> {
  return postJSON<CheckEmailRequest, CheckEmailResponse>(ROUTES.checkEmail, { email });
}

export function register(payload: RegisterRequest): Promise<RegisterResponse> {
  return postJSON<RegisterRequest, RegisterResponse>(ROUTES.register, payload);
}
