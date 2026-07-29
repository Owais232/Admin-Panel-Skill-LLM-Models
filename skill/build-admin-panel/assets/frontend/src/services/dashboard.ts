'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiEnvelope, DashboardStats } from '@/types';

/**
 * GET /admin/stats returns ONE nested object rather than a list, so the whole
 * payload sits under `data` with no `meta`.
 *
 * Keep it a single endpoint: a dashboard that fires eight parallel count
 * queries is eight round trips the server can't cache as a unit.
 */
export function useStats(days = 30) {
  return useQuery({
    queryKey: ['admin', 'stats', days],
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<DashboardStats>>('/admin/stats', {
        params: { days },
      });
      return res.data.data;
    },
  });
}
