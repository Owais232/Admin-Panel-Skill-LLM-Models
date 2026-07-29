'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  // Stable per-browser device id, sent on login + refresh so the backend's
  // multi-device session mode can track this admin session.
  deviceId: string | null;
  hydrated: boolean;
  setSession: (payload: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => void;
  setAccessToken: (accessToken: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  ensureDeviceId: () => string;
  clear: () => void;
  setHydrated: () => void;
}

function randomDeviceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `admin-web-${crypto.randomUUID()}`;
  }
  return `admin-web-${Math.random().toString(36).slice(2)}${Date.now()}`;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      deviceId: null,
      hydrated: false,
      setSession: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      ensureDeviceId: () => {
        const existing = get().deviceId;
        if (existing) return existing;
        const id = randomDeviceId();
        set({ deviceId: id });
        return id;
      },
      clear: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      // Rename per panel so two panels open in the same browser cannot
      // clobber each other's session.
      name: 'admin-panel-auth',
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

// Non-reactive accessors for use inside the axios interceptors.
export const authStore = {
  get: () => useAuthStore.getState(),
};
