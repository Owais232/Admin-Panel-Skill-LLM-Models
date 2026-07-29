'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { BRAND } from '@/lib/branding';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Required on /dashboard, or it stays highlighted on every nested route. */
  exact?: boolean;
}

/**
 * Group by domain rather than one flat list, past about six entries a flat
 * sidebar stops being scannable. Add a section per domain as pages are built.
 */
const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: 'People',
    items: [{ href: '/dashboard/users', label: 'Users', icon: Users }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-5 font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
        </span>
        {BRAND.name}
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
