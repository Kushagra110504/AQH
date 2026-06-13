import { useAppStore } from '../store/useAppStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_URL}${path}`;
  const headers = new Headers(options.headers || {});

  // Automatically inject Bearer Token from Zustand Store
  const token = useAppStore.getState().user?.token;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'An unexpected error occurred.';
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.message || errorMsg;
    } catch (err) {
      // Ignored
    }
    throw new Error(errorMsg);
  }

  // Handle empty or text responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return response.text() as unknown as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'GET' }),
    
  post: <T>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      headers: body instanceof FormData
        ? options?.headers
        : { 'Content-Type': 'application/json', ...options?.headers },
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
    
  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
