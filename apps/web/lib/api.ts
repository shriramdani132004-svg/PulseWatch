import type { ApiErrorBody } from '@pulsewatch/shared';

const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const fallbackBase = process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '';

export const API_BASE_URL = (rawBase || fallbackBase).replace(/\/$/, '');
export const API_DOCS_URL = API_BASE_URL ? `${API_BASE_URL}/api/docs` : '';

export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let refreshPromise: Promise<boolean> | null = null;

function unauthorizedEvent(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pulsewatch:unauthorized'));
  }
}

function extractError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') {
    const payload = body as Partial<ApiErrorBody>;
    const rawMessage = payload.message;
    if (Array.isArray(rawMessage)) {
      return new ApiError(status, rawMessage[0] ?? 'Request failed', rawMessage);
    }
    if (typeof rawMessage === 'string') {
      return new ApiError(status, rawMessage);
    }
    if (typeof payload.error === 'string') {
      return new ApiError(status, payload.error);
    }
  }
  return new ApiError(status, status === 0 ? 'Network request failed' : `Request failed (${status})`);
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function refreshSession(): Promise<boolean> {
  if (!API_BASE_URL) return false;
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipRefresh?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(0, 'The API base URL is not configured for this deployment.');
  }
  const { body, skipRefresh, headers, ...rest } = options;
  const requestHeaders = new Headers(headers);
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json');
  }
  requestHeaders.set('Accept', 'application/json');

  const execute = async (): Promise<Response> =>
    fetch(`${API_BASE_URL}/api/v1${path}`, {
      ...rest,
      credentials: 'include',
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });

  let response: Response;
  try {
    response = await execute();
  } catch {
    throw new ApiError(0, 'Unable to reach the PulseWatch API. Check your connection and try again.');
  }

  const canRefresh =
    !skipRefresh &&
    response.status === 401 &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/register') &&
    !path.startsWith('/auth/refresh') &&
    !path.startsWith('/auth/logout');

  if (canRefresh && (await refreshSession())) {
    try {
      response = await execute();
    } catch {
      throw new ApiError(0, 'Unable to reach the PulseWatch API. Check your connection and try again.');
    }
  }

  const parsed = await parseBody(response);
  if (!response.ok) {
    if (response.status === 401) unauthorizedEvent();
    throw extractError(response.status, parsed);
  }
  return parsed as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
