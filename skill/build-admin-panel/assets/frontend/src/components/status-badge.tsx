import { Badge, type BadgeProps } from '@/components/ui/badge';
import { titleCase } from '@/lib/utils';

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  // account / generic
  active: 'success',
  inactive: 'secondary',
  verified: 'success',
  unverified: 'warning',
  blocked: 'destructive',
  deleted: 'destructive',
  // roles
  admin: 'default',
  user: 'secondary',
  // content state
  published: 'success',
  draft: 'secondary',
  downloaded: 'info',
  // platforms
  ios: 'info',
  android: 'success',
  web: 'secondary',
};

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
      {titleCase(status)}
    </Badge>
  );
}

/** Convenience: active/inactive boolean → badge. */
export function ActiveBadge({ active }: { active?: boolean }) {
  return <StatusBadge status={active ? 'active' : 'inactive'} />;
}
