'use client';

import { AlertTriangle, UserCheck, UserPlus, Users } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/utils';
import { useStats } from '@/services/dashboard';

/**
 * Starter dashboard against the universal `/admin/stats` contract.
 *
 * Add a StatCard per headline figure and a chart per trend as the backend
 * grows sections. Every card that maps to a list page should link to it,
 * "17 blocked users" is only useful if it is one click from the filtered list.
 */
export default function DashboardPage() {
  const { data, isLoading } = useStats(30);
  const users = data?.users;

  const cards = [
    {
      label: 'Total users',
      value: formatNumber(users?.total ?? 0),
      icon: Users,
      href: '/dashboard/users',
      hint: `${formatNumber(users?.newInRange ?? 0)} new in 30d`,
    },
    {
      label: 'Active users',
      value: formatNumber(users?.active ?? 0),
      icon: UserCheck,
      href: '/dashboard/users',
    },
    {
      label: 'Blocked users',
      value: formatNumber(users?.blocked ?? 0),
      icon: AlertTriangle,
      href: '/dashboard/users',
      accent: (users?.blocked ?? 0) > 0,
    },
    {
      label: 'New in range',
      value: formatNumber(users?.newInRange ?? 0),
      icon: UserPlus,
      hint: `${data?.range?.days ?? 30} day window`,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Platform activity for the last 30 days."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[92px] rounded-xl" />
            ))
          : cards.map((card) => <StatCard key={card.label} {...card} />)}
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="text-sm font-medium">New users (last 30 days)</h3>
          {isLoading ? (
            <Skeleton className="h-[240px]" />
          ) : (users?.newSignupsByDay?.length ?? 0) === 0 ? (
            // Empty state matters: Mongo only emits days that have data, so a
            // quiet month legitimately returns an empty series.
            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
              No signups in this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={users?.newSignupsByDay ?? []}>
                <defs>
                  <linearGradient id="signups" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value: string) => value.slice(5)}
                />
                <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  fill="url(#signups)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
