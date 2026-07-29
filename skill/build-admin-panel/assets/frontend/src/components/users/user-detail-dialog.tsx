'use client';

/**
 * WORKED EXAMPLE, clone this per entity that needs a detail view.
 *
 * Pattern: the list passes the row it already has so the dialog paints
 * instantly, then `useUser` refetches the full record and takes over. That
 * avoids a spinner on every row click while still showing fields the list
 * projection omits.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useBlockUser, useUnblockUser, useUser } from '@/services/users';
import type { AdminUser } from '@/types';

type PendingAction = 'block' | 'unblock' | null;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value ?? '—'}</span>
    </div>
  );
}

export function UserDetailDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Only fetch while open, so closing the dialog doesn't leave a live query.
  const { data, isLoading } = useUser(open ? (user?._id ?? null) : null);
  const [action, setAction] = useState<PendingAction>(null);

  const block = useBlockUser();
  const unblock = useUnblockUser();

  // Hooks must run before this early return, never move it above them.
  if (!user) return null;

  const detail = data?.user ?? user;
  const pending = block.isPending || unblock.isPending;

  async function run(fn: () => Promise<unknown>, success: string) {
    try {
      await fn();
      toast.success(success);
      setAction(null);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{detail.email ?? detail.phone ?? 'User'}</DialogTitle>
          <DialogDescription>{detail._id}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="divide-y">
            <Row label="Role" value={<StatusBadge status={detail.role} />} />
            <Row
              label="Status"
              value={
                <span className="flex flex-wrap justify-end gap-1">
                  <StatusBadge status={detail.isBlocked ? 'blocked' : 'active'} />
                  {detail.isActive === false ? (
                    <StatusBadge status="inactive" />
                  ) : null}
                </span>
              }
            />
            {detail.isBlocked && detail.blockedReason ? (
              <Row label="Blocked reason" value={detail.blockedReason} />
            ) : null}
            <Row
              label="Email verified"
              value={
                <StatusBadge
                  status={detail.isEmailVerified ? 'verified' : 'unverified'}
                />
              }
            />
            <Row
              label="Last login"
              value={
                detail.lastLoginAt ? formatDateTime(detail.lastLoginAt) : '—'
              }
            />
            <Row label="Joined" value={formatDateTime(detail.createdAt)} />
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          {detail.isBlocked ? (
            <Button
              variant="outline"
              disabled={pending}
              data-testid="toggle-block"
              onClick={() => setAction('unblock')}
            >
              Unblock
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={pending}
              data-testid="toggle-block"
              onClick={() => setAction('block')}
            >
              Block
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Confirms stack over the detail dialog rather than replacing it, so
          the admin keeps the context they are acting on in view. */}
      <ConfirmDialog
        open={action === 'block'}
        title={`Block ${detail.email ?? 'this user'}?`}
        description="They will be signed out immediately and cannot log in until unblocked."
        confirmLabel="Block user"
        destructive
        requireReason
        pending={block.isPending}
        onOpenChange={(next) => !next && setAction(null)}
        onConfirm={(reason) =>
          void run(
            () => block.mutateAsync({ id: detail._id, reason }),
            'User blocked',
          )
        }
      />

      <ConfirmDialog
        open={action === 'unblock'}
        title={`Unblock ${detail.email ?? 'this user'}?`}
        description={
          detail.isActive === false
            ? 'Note: this account is also marked inactive, which is a separate flag. Unblocking alone will not restore their login.'
            : 'They will be able to log in again.'
        }
        confirmLabel="Unblock user"
        pending={unblock.isPending}
        onOpenChange={(next) => !next && setAction(null)}
        onConfirm={() =>
          void run(() => unblock.mutateAsync(detail._id), 'User unblocked')
        }
      />
    </Dialog>
  );
}
