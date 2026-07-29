'use client';

import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { ApiEnvelope, AuthUser } from '@/types';

/**
 * ADAPT: the field name the login endpoint expects.
 *
 * `email` is the common case. Backends that accept either an email or a phone
 * number usually call it `identifier` instead, sending the wrong key is a 400
 * that reads like a validation bug, so check the LoginDto.
 */
const IDENTIFIER_FIELD: 'email' | 'identifier' = 'email';

/**
 * ADAPT: some backends record the calling platform and/or a per-device id on
 * login and require them. Drop these if the DTO does not declare them,
 * `forbidNonWhitelisted` turns an unknown key into a 400.
 */
const SEND_DEVICE_ID = true;
const PLATFORM: string | null = 'web';

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * Password login.
 *
 * Most apps have no separate admin-login endpoint, everyone posts to
 * /auth/login and the account simply carries an admin role. The login page
 * rejects non-admins client-side for a friendlier message; every /admin/*
 * endpoint enforces the same thing server-side via RolesGuard, which is the
 * real gate.
 */
export async function adminLogin(
  identifier: string,
  password: string,
): Promise<LoginResponse> {
  const deviceId = SEND_DEVICE_ID
    ? useAuthStore.getState().ensureDeviceId()
    : null;

  const res = await api.post<ApiEnvelope<LoginResponse>>('/auth/login', {
    [IDENTIFIER_FIELD]: identifier,
    password,
    ...(deviceId ? { deviceId } : {}),
    ...(PLATFORM ? { platform: PLATFORM } : {}),
  });

  return res.data.data;
}

/** Best-effort server-side session revoke; the client clears regardless. */
export async function logout(): Promise<void> {
  await api.post('/auth/logout', {});
}
