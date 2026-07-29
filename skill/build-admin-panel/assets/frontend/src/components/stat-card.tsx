import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  /** Makes the whole card a link into the matching list page. */
  href?: string;
  /** Highlights a figure that needs attention (overdue, blocked, failing). */
  accent?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
  accent,
}: StatCardProps) {
  const body = (
    // h-full so cards with and without a `hint` line still align in a grid.
    <Card
      className={cn(
        'h-full transition-colors',
        href && 'cursor-pointer hover:border-primary/50',
        accent && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <CardContent className="flex h-full items-center justify-between p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full',
              accent
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
