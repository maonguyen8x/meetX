export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  errorCode?: string;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const isAuthRoute = path.startsWith('/api/');
  try {
    const response = await fetch(isAuthRoute ? path : `/api/proxy${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin',
    });
    const text = await response.text();
    const json = text ? (JSON.parse(text) as unknown) : undefined;
    if (response.ok) return { ok: true, status: response.status, data: json as T };
    const code = (json as { error?: { code?: string } } | undefined)?.error?.code;
    return { ok: false, status: response.status, errorCode: code ?? 'UNKNOWN' };
  } catch {
    return { ok: false, status: 0, errorCode: 'NETWORK_ERROR' };
  }
}
