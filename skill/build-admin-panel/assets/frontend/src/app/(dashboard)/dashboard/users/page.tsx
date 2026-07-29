'use client';

/**
 * WORKED EXAMPLE, clone this page per entity.
 *
 * The house layout is always:
 *   space-y-6 > PageHeader > filter row > DataTable > dialogs
 *
 * Detail and edit are ALWAYS a dialog, never an `/[id]` route: an admin
 * scanning a list wants to peek at a row and get back without losing their
 * filters and scroll position.
 */

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { DataTable, type Column } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { UserDetailDialog } from '@/components/users/user-detail-dialog';
import { formatDate } from '@/lib/utils';
import { useUsers } from '@/services/users';
import type { AdminUser } from '@/types';

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);

  // Debounce search by ~350ms and reset to page 1, or typing fires a request
  // per keystroke against page N of the previous result set.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useUsers({
    page,
    limit: 20,
    search: search || undefined,
    role: role || undefined,
    status: status || undefined,
  });

  const columns: Column<AdminUser>[] = [
    {
      header: 'User',
      cell: (user) => (
        <div>
          <p className="font-medium">{user.email ?? user.phone ?? '—'}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {user._id}
          </p>
        </div>
      ),
    },
    { header: 'Role', cell: (user) => <StatusBadge status={user.role} /> },
    {
      header: 'Status',
      cell: (user) => (
        // Check the schema before collapsing these into one status, blocked
        // and inactive are usually independent flags, and merging them hides
        // the case where unblocking alone does not restore access.
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={user.isBlocked ? 'blocked' : 'active'} />
          {user.isActive === false ? <StatusBadge status="inactive" /> : null}
          {user.isEmailVerified === false ? (
            <StatusBadge status="unverified" />
          ) : null}
        </div>
      ),
    },
    {
      header: 'Joined',
      cell: (user) => (
        <span className="text-muted-foreground">
          {formatDate(user.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Everyone registered on the platform."
      />

      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search email or phone…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <Select
          className="max-w-[180px]"
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </Select>
        <Select
          className="max-w-[180px]"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(user) => user._id}
        onPageChange={setPage}
        onRowClick={setSelected}
        emptyMessage="No users found."
      />

      <UserDetailDialog
        user={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
