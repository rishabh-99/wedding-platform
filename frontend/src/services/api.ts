import type { ApiErrorBody } from '@wedding/shared';

/** Error with a guest-friendly message and optional per-field messages. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let csrfToken: string | null = null;
export const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};

const FRIENDLY_OFFLINE = 'We could not reach the server. Please check your connection and try again.';

export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  const method = (init.method ?? 'GET').toUpperCase();
  if (csrfToken && method !== 'GET' && method !== 'HEAD') headers.set('X-CSRF-Token', csrfToken);
  headers.set('Accept', 'application/json');

  let res: Response;
  try {
    res = await fetch(path, { ...init, method, headers, body, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'NETWORK', FRIENDLY_OFFLINE);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON (e.g. proxy error page) */
  }
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    const fields = ((err?.details as { fields?: Record<string, string> } | undefined)?.fields) ?? {};
    const message =
      err?.message ??
      (res.status >= 500 || res.status === 0
        ? 'The server is having a moment. Please try again shortly.'
        : 'Something went wrong. Please try again.');
    throw new ApiError(res.status, err?.code ?? 'HTTP_ERROR', message, fields);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => apiFetch<T>(path, init),
  post: <T>(path: string, json?: unknown) => apiFetch<T>(path, { method: 'POST', json }),
  put: <T>(path: string, json?: unknown) => apiFetch<T>(path, { method: 'PUT', json }),
  patch: <T>(path: string, json?: unknown) => apiFetch<T>(path, { method: 'PATCH', json }),
  del: <T = void>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/**
 * Uploads with progress (fetch cannot report upload progress). Used by the admin
 * uploader and the guestbook photo field.
 */
export function uploadWithProgress<T>(
  url: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else {
        const err = (data as ApiErrorBody | null)?.error;
        // Multi-file uploads return per-file results even on 400.
        if (data && (data as { results?: unknown }).results) return resolve(data as T);
        reject(new ApiError(xhr.status, err?.code ?? 'UPLOAD_FAILED', err?.message ?? 'The upload failed. Please try again.'));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', FRIENDLY_OFFLINE));
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}
