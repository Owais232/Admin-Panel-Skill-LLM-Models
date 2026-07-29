'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/lib/branding';
import { useAuthStore } from '@/lib/auth-store';
import { logout } from '@/services/auth';

export function Topbar() {
  const router = useRouter();
  const { user, clear } = useAuthStore();

  async function handleLogout() {
    // Best-effort server-side revoke; clear locally regardless so a failing
    // logout endpoint can never trap the admin in a signed-in state.
    await logout().catch(() => undefined);
    clear();
    router.replace('/login');
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-5">
      <div className="font-medium md:hidden">{BRAND.name}</div>
      <div className="ml-auto flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium leading-tight">
            {user?.email ?? 'Administrator'}
          </p>
          <p className="text-xs text-muted-foreground">Admin</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleLogout}
          title="Log out"
          // The verify script targets this aria-label, keep it if you restyle.
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
