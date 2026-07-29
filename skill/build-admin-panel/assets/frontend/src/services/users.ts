'use client';

/**
 * WORKED EXAMPLE, clone this file per entity.
 *
 * The shape is always the same: a typed query interface, one `useQuery` per
 * read endpoint, one `useMutation` per write, and a single `invalidate()`
 * helper every mutation calls on success. See
 * `references/frontend-recipes.md` for the checklist.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, clean, unwrapList } from '@/lib/api';
import type { AdminUser, AdminUserDetail, ApiEnvelope } from '@/types';

export interface UsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * GET /admin/users -> `{ data: AdminUser[], meta }`, meta at the TOP level.
 *
 * `clean()` strips empty values because the backend rejects unknown query keys
 * with a 400 rather than ignoring them.
 */
export function useUsers(query: UsersQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<AdminUser[]>>('/admin/users', {
        params: clean(query),
      });
      return unwrapList(res.data);
    },
  });
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'user', id],
    // Keeps the hook unconditional (rules of hooks) while the dialog is closed.
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<AdminUserDetail>>(
        `/admin/users/${id}`,
      );
      return res.data.data;
    },
  });
}

// --- mutations ---------------------------------------------------------------

/**
 * One invalidator per domain, always also busting `['admin','stats']`, the
 * dashboard counts these records, so a write that doesn't refresh it leaves
 * the panel visibly self-contradictory.
 */
function invalidateUsers(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  void qc.invalidateQueries({ queryKey: ['admin', 'user'] });
  void qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      (await api.patch(`/admin/users/${id}/block`, { reason })).data,
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.patch(`/admin/users/${id}/unblock`)).data,
    onSuccess: () => invalidateUsers(qc),
  });
}
