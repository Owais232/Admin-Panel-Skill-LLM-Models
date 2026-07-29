# The stack, the scaffold, and the house conventions

This skill carries its own template so that every panel built with it comes
out of the same family. Do not substitute a different stack because a newer
one exists, the value here is that one engineer can open any panel built this
way and already know where everything lives.

## The stack, and why each piece

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router, **client-only** | Every page is `'use client'`. Server components buy nothing here: the data is per-admin, behind a bearer token, and never cached or indexed. Trying to mix them just fights the auth store. |
| Styling | Tailwind 3.4 + CSS-variable tokens | Rebranding is a hue change in one file. |
| Primitives | Hand-copied Radix wrappers in `components/ui/` | Owned outright, no component-library upgrade treadmill, trivially restyled. |
| Data | TanStack Query 5 | Cache invalidation after mutations is the entire job of an admin panel's data layer. |
| HTTP | axios + interceptors | One place for the bearer token and the 401-refresh queue. |
| Auth state | zustand + `persist` | Survives reload; the `hydrated` flag prevents the redirect flash. |
| Toasts | sonner | |
| Charts | recharts | |
| Icons | lucide-react | |
| Port | 3001 in dev | Leaves 3000 for the product's own web app. |
| Config | one `NEXT_PUBLIC_API_URL` | Nothing else is environment-specific. |

## Non-obvious details in the scaffold

**`lib/api.ts`, the single-flight refresh queue.** When an access token
expires, every in-flight request 401s at once. Without queueing, each fires its
own refresh call. Auth endpoints are commonly rate-limited (5/min is typical),
so several open tabs plus React StrictMode's double-effects will trip the limit
and log the admin out, intermittently, which is miserable to debug. The queue
makes concurrent 401s wait on one refresh.

`clean()` lives here too. Use it on every list request: NestJS backends
typically run `forbidNonWhitelisted: true`, so an unknown *or empty-string*
query key is a 400, not an ignored parameter. A filter `<Select>` reset to `''`
is the usual trigger.

**`lib/auth-store.ts`, the `hydrated` flag.** zustand's `persist` rehydrates
asynchronously. On first paint the store is empty, so a guard that checks
`accessToken` alone bounces an authenticated admin to `/login` on every hard
refresh. Every guard must wait for `hydrated` first. The scaffold's dashboard
layout and index page both do; keep it that way.

The persist key is namespaced per panel, so two panels open in the same browser
cannot clobber each other's session.

**`(dashboard)/layout.tsx`, the route-group guard.** One `useEffect` protects
every nested page. It checks both a token and `role === 'admin'`; the server's
`RolesGuard` is the real gate; this just avoids showing a non-admin a shell
that 403s on every request.

**`components/data-table.tsx`.** Generic over the row type. Columns are
`{header, cell, className}`, deliberately render-prop, not a column-config DSL,
because admin tables always end up wanting bespoke cells. Renders its own
skeleton and empty state so no page reimplements them.

**`components/confirm-dialog.tsx`.** Not `window.confirm`. Most destructive
admin endpoints require a reason string that a native confirm cannot collect,
and the reason is what makes the audit log useful later.

## House conventions

Follow these exactly; consistency is the point.

**Page shape.** Every list page:

```
'use client'
<div className="space-y-6">
  <PageHeader title description />
  <div className="flex flex-wrap gap-2">  {/* filters */}
  <DataTable … />
  <XDetailDialog … />
</div>
```

**Detail and edit are always a dialog, never an `/[id]` route.** An admin
scanning a list wants to peek at a row and get back without losing filters and
scroll position.

**Query keys** are `['admin', <domain>, query]`. One `invalidate(qc)` helper per
service file, called by every mutation's `onSuccess`, and it **always also busts
`['admin','stats']`**, the dashboard counts these records, and a panel showing
"3 blocked" next to a list of 4 looks broken.

**Filters** debounce search at ~350 ms and reset `page` to 1 on any change.

**Forms** are `useState` per field. No form library; these are three-to-six field
dialogs, and a resolver-plus-schema setup is more machinery than the problem
justifies.

**Sidebar** is grouped by domain, not one flat list. Past ~6 entries a flat
list stops being scannable.

**Empty states are written, not defaulted.** "No scans recorded yet" beats a
blank rectangle, and it distinguishes *no data* from *failed to load*.

**Money is never summed across currencies**, and any figure the backend flags
as volatile says so in the UI at the point of action.

## Rebranding

Two files, and `scripts/create-panel.sh` writes both:

1. `src/lib/branding.ts`, name, description, tagline, login highlights.
2. `src/app/globals.css`, the hue of `--primary`/`--ring` in both the `:root`
   and `.dark` blocks.

Everything else is derived neutrals that work against any hue.
