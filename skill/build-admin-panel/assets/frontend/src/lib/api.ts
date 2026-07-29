'use client';

import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { authStore, useAuthStore } from './auth-store';
import type { ApiEnvelope, PaginationMeta } from '@/types';

// Origin of the backend, WITHOUT the version prefix.
// ADAPT `API_PREFIX` to the backend's global prefix ('' if it has none).
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const API_PREFIX = '/api/v1';
const API_V1 = `${API_BASE}${API_PREFIX}`;

export const api: AxiosInstance = axios.create({
  baseURL: API_V1,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = authStore.get().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Refresh-on-401 handling ---
// Single-flight: concurrent 401s queue behind ONE refresh call rather than
// each firing their own. This matters more than it looks, auth endpoints are
// commonly rate-limited (5/min is typical), and several open tabs plus React
// StrictMode's double-effects will trip that limit without the queue.
//
//   POST /auth/refresh-token { refreshToken, deviceId }
//     -> { success, data: { accessToken, refreshToken, ... } }
let isRefreshing = false;
let pendingQueue: {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}[] = [];

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach((p) => {
    if (token) p.resolve(token);
    else p.reject(error);
  });
  pendingQueue = [];
}

async function requestNewTokens(
  refreshToken: string,
  deviceId: string | null,
): Promise<{ accessToken: string; refreshToken?: string }> {
  // Bare axios call so this request is not itself intercepted.
  const res = await axios.post(`${API_V1}/auth/refresh-token`, {
    refreshToken,
    ...(deviceId ? { deviceId } : {}),
  });
  const data = res.data?.data ?? res.data;
  const accessToken: string = data?.accessToken;
  if (!accessToken) throw new Error('No access token in refresh response');
  return { accessToken, refreshToken: data?.refreshToken };
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const status = error.response?.status;
    const { refreshToken, deviceId } = authStore.get();

    const isAuthEndpoint =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh-token');

    if (status === 401 && !original?._retry && refreshToken && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token: string) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const tokens = await requestNewTokens(refreshToken, deviceId);
        useAuthStore.getState().setAccessToken(tokens.accessToken);
        if (tokens.refreshToken) {
          useAuthStore.getState().setRefreshToken(tokens.refreshToken);
        }
        flushQueue(null, tokens.accessToken);
        original.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(original);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        useAuthStore.getState().clear();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

/** Extracts a human-readable message from an Axios error. */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[]; error?: { details?: string } }
      | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (msg) return msg;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

/** Unwraps the `data` field of the standard envelope. */
export function unwrap<T>(payload: ApiEnvelope<T>): T {
  return payload.data;
}

/**
 * Unwraps a paginated list response into its items + meta.
 *
 * ADAPT alongside `ApiEnvelope` if the backend nests pagination inside `data`
 * instead of lifting it to the top level.
 */
export function unwrapList<T>(payload: ApiEnvelope<T[]>): {
  items: T[];
  meta?: PaginationMeta;
} {
  return { items: payload.data ?? [], meta: payload.meta };
}

/**
 * Strips undefined/null/empty values from a query object.
 *
 * Use this on EVERY list request. NestJS backends typically run the global
 * ValidationPipe with `forbidNonWhitelisted: true`, which rejects an unknown,
 * or empty-string, query key with a 400 instead of ignoring it. A filter
 * `<Select>` reset to `''` is the usual way this bites.
 */
export function clean(query: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  );
}

export { API_BASE, API_PREFIX, API_V1 };
