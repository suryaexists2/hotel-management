interface StandardResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  meta?: { page?: number; limit?: number; total?: number };
}

const TOKEN_KEY = 'innsight_access_token';
const TOKEN_COOKIE = 'accessToken';

function setAccessTokenCookie(token: string | null): void {
  if (token) {
    document.cookie = `${TOKEN_COOKIE}=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
  } else {
    document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0`;
  }
}

export function setAccessToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    setAccessTokenCookie(token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    setAccessTokenCookie(null);
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  try {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const json: StandardResponse<{ accessToken: string }> = await res.json();
    if (json.success && json.data) {
      setAccessToken(json.data.accessToken);
      return json.data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function refreshToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = attemptRefresh().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    skipAuth = false,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (!skipAuth) {
      const token = getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    let res = await fetch(url, { ...options, headers, credentials: 'include' });

    if (res.status === 401 && !skipAuth) {
      const newToken = await refreshToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(url, { ...options, headers, credentials: 'include' });
      } else {
        setAccessToken(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new ApiError('Session expired', 'SESSION_EXPIRED', 401);
      }
    }

    const json: StandardResponse<T> = await res.json();

    if (!json.success) {
      throw new ApiError(
        json.error?.message || 'An unexpected error occurred',
        json.error?.code || 'UNKNOWN_ERROR',
        res.status,
        json.error?.details,
      );
    }

    return json.data as T;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async getPaginated<T>(path: string): Promise<{ items: T[]; total: number; page: number; limit: number; totalPages: number }> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    let res = await fetch(url, { method: 'GET', headers, credentials: 'include' });
    if (res.status === 401) {
      const newToken = await refreshToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(url, { method: 'GET', headers, credentials: 'include' });
      } else {
        setAccessToken(null);
        if (typeof window !== 'undefined') window.location.href = '/login';
        throw new ApiError('Session expired', 'SESSION_EXPIRED', 401);
      }
    }
    const json: StandardResponse<T[]> = await res.json();
    if (!json.success) throw new ApiError(json.error?.message || 'Error', json.error?.code || 'UNKNOWN_ERROR', res.status);
    const meta = json.meta as { page: number; limit: number; total: number; totalPages?: number } | undefined;
    return { items: json.data as T[], total: meta?.total ?? 0, page: meta?.page ?? 1, limit: meta?.limit ?? 20, totalPages: meta?.totalPages ?? 1 };
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  async postWithoutAuth<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(
      path,
      {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      },
      true,
    );
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = new ApiClient();