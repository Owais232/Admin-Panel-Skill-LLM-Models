# Adding an entity to the panel

The scaffold ships `users` as a worked example: a service file, a list page,
and a detail dialog. Every other entity is that trio again. Copy them; do not
invent a second pattern.

## The checklist

For an entity `widgets`:

1. **Type**: add `AdminWidget` to `src/types/index.ts`, mirroring the real
   schema field for field. Mark fields the backend flags as independent axes
   (e.g. `isActive` vs `isBlocked`) so nobody merges them later.
2. **Service**: copy `src/services/users.ts` → `widgets.ts`. Change the query
   key to `['admin', 'widgets', query]`, the endpoints, and the
   `invalidateWidgets()` helper. Keep the `['admin','stats']` invalidation.
3. **Page**: copy `src/app/(dashboard)/dashboard/users/page.tsx` →
   `widgets/page.tsx`. Change the columns, the filters, and the empty message.
4. **Dialog**: copy `src/components/users/user-detail-dialog.tsx` →
   `widgets/widget-detail-dialog.tsx`.
5. **Sidebar**: add it to the right section in
   `src/components/app-shell/sidebar.tsx`, creating a new section if it does
   not belong in an existing domain.
6. **Verify**: add `['/dashboard/widgets', 'Widgets']` to `PAGES` in
   `verify.js`.

## Columns

Two or three fields per cell, primary bold and secondary muted, beats twelve
narrow columns:

```tsx
{
  header: 'Widget',
  cell: (w) => (
    <div>
      <p className="font-medium">{w.name}</p>
      <p className="line-clamp-1 text-xs text-muted-foreground">{w.sku}</p>
    </div>
  ),
}
```

Right-align numbers with `className: 'text-right'` and render them
`tabular-nums`, or columns of figures jitter as you page.

Render status through `<StatusBadge>` rather than raw text. Add new status
strings to its `STATUS_VARIANT` map, an unmapped status still renders, as an
outline badge, so this degrades safely.

## Filters

Debounced search plus a couple of `<Select>`s. Every filter change resets
`page` to 1, otherwise a filter that narrows results to one page leaves the
admin staring at an empty page 4.

Pass `undefined`, never `''`, for an unset filter: the backend rejects unknown
and empty query keys with a 400. `clean()` in `lib/api.ts` handles this, but
only if the value is actually `undefined` by the time it gets there.

## Detail dialogs

The list passes the row it already has, so the dialog paints instantly; the
detail query then refetches and takes over. Guard the query with
`enabled: Boolean(id)` and pass `null` when closed so it does not stay live.

Keep the early `if (!entity) return null` **below** every hook call.

Actions live in `DialogFooter`. Anything destructive or irreversible routes
through `<ConfirmDialog>`, which stacks over the detail dialog rather than
replacing it, so the admin keeps the record in view while confirming. Use
`requireReason` wherever the backend records one; the reason is what makes the
audit log worth having.

Surface backend warnings verbatim. If a mutation returns `volatile: true` with
a warning, toast it, the admin needs to know a grant will not survive the next
renewal *at the moment they grant it*, not a month later.

## Dashboard cards

Every card that corresponds to a list page should link to it, "17 blocked
users" is only useful if it is one click from the filtered list. Use `accent`
for figures that mean something is wrong (overdue, blocked, failing) so the
dashboard reads at a glance.

Charts need an explicit empty state. A zero-length series renders as an empty
box that looks identical to a failed request.

## Things that look like bugs but are not

- **A `?_rsc=` request showing as failed/aborted**: that is the Next.js router
  cancelling a prefetch on navigation. Working as intended; `verify.js` filters
  these.
- **Images 404ing from object storage in seeded data**: bad test data, not a
  broken panel. Real uploads resolve.
- **The panel stuck on "Loading…" after running a production build**: see the
  dev-server cache trap in `build-and-verify.md`. It is not the auth guard.
