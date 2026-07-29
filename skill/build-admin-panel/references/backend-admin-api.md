# The admin API

One new module, not scattered edits across every existing module.

```
src/modules/admin/
├── admin.module.ts
├── admin.constants.ts              ← the safe projection
├── decorators/admin-only.decorator.ts
├── dto/            admin-list-query.dto.ts + one per domain
├── controllers/    one per domain
├── services/       one per domain, plus admin-audit.service.ts
├── repositories/   cross-tenant finders
└── schemas/        admin-audit-log.schema.ts
```

Drop-in files for all of this are in `assets/backend/nest/`.

## The envelope contract: settle this first

Response interceptors typically branch on the shape the handler returns, tested
in order. A representative one:

| # | Handler returns | Client receives |
|---|---|---|
| ① | `{items, meta}` | `{success, message, data: items, meta, …}`, meta at TOP level |
| ② | `{data, message?, meta?}` | `{success, message, data, meta, …}` |
| ③ | anything else | payload nested whole under `data` |

Consequences worth internalising:

- **Return the pagination utility's result verbatim** from list handlers so
  they land on branch ①. Do not spread it (`{...result, extra}` silently drops
  `extra`), do not wrap it (`{data: result}` nests `data.items` and loses
  top-level `meta`).
- A stats endpoint returning one nested object must **never grow a top-level
  `data` key**, or it flips branch and the client reads one level too deep.

Verify with `curl` and read the raw JSON before building the second endpoint.
This is the cheapest 60 seconds in the whole project.

## Security

**Apply `ADMIN_USER_SAFE_PROJECTION` to every user read.** See
`assets/backend/nest/admin/admin.constants.ts`. Most schemas mark only
`password` as `select: false`; every OTP and reset token is returned by
default. The UI never displays them, so this is invisible until someone reads
the raw response, by which point the panel has been shipping live credentials
into browser network tabs.

A `.populate('user')` with no `select` bypasses the projection entirely and
returns the whole document. Every populate of a user reference needs
`ADMIN_USER_SUMMARY_SELECT`.

**Guard order.** `@UseGuards(JwtAuthGuard, RolesGuard)`, reversed is a
permanent 401. Use the `@AdminOnly()` composite so it cannot be got wrong
per-controller.

**Module imports.** Guards are instantiated in the *consuming* module's
injector. If `JwtAuthGuard` injects a `UserRepository`, `AdminModule` must
import `UserModule` as well as `AuthModule`, or Nest fails at boot with an
error naming the repository, which points at the wrong module entirely.

## Query and filter safety

- **`forbidNonWhitelisted: true` is usually global.** Any query key not
  declared on a DTO is a 400. Every filter the panel sends needs a real DTO
  field, and the client must strip empty values.
- **Escape user input before building a regex.** `?search=(` is an unhandled
  exception, a 500 from a search box. Use a shared `escapeRegExp()`.
- **Coerce booleans.** `?isBlocked=false` arrives as the string `'false'`,
  which is truthy. Use the `ToBoolean` transform on every boolean filter.
- **Whitelist `sortBy` with `@IsIn([...])`.** Never interpolate a raw query
  value into a Mongo sort key.
- **`declare` does not override a base DTO's default.** A subclass writing
  `declare sortOrder?: SortOrder` typechecks fine and still inherits the
  parent's `'desc'` at runtime, the list sorts backwards and nothing errors.
  Use `override sortOrder?: SortOrder = 'asc'`.
- **Route ordering: declare literal segments before `@Get(':id')`**, or
  `/admin/subscriptions/products` is swallowed by the param route and tries to
  look up a subscription with id `"products"`.
- **Mongoose does not always cast id strings on `ref` paths.**
  `findOne({user: '<id string>'})` can silently return `null` where
  `new Types.ObjectId(id)` matches. Silent because it is a legitimate empty
  result, not an error. When a filter on a reference field returns nothing that
  should exist, suspect this first.

**Searching across collections.** When the searchable field lives on a related
document (a name on `Profile`, not `User`), resolve it in **two steps**: find
matching ids, then `$in` them into the main query, rather than `$lookup`. The
two-step keeps the pagination utility and therefore the `{items, meta}`
envelope contract intact, and preserves any auto-populate hooks. Cap the
intermediate id list.

## Stats

One `GET /admin/stats?days=30` endpoint returning one nested object, built from
`$facet` aggregations in `Promise.all`, cached in Redis ~60s since they are
collection-wide scans. Not eight parallel count endpoints.

The universal contract the scaffolded dashboard expects:

```
{ generatedAt, range: {from, to, days},
  users: { total, active, blocked, newInRange,
           byRole: [{role, count}], newSignupsByDay: [{date, count}] },
  …domain sections… }
```

Four correctness rules:

- **`$facet` sub-pipelines using `$count` return `[]` when empty.** Normalise
  every counter with `rows[0]?.count ?? 0` or the dashboard renders `undefined`.
- **Zero-fill date series.** Mongo only emits days that have data, so a chart
  built straight from the result silently compresses quiet days out of the
  x-axis rather than showing a dip.
- **Never sum money across currencies.** Group by currency and return an array.
  And check the sign convention on refunds: they are frequently stored as
  positive amounts, so a naive `$sum` reports refunds as income. Split with
  `$cond`.
- **Optional date fields drop rows.** `$ifNull: ['$purchaseDate', '$createdAt']`
  or records silently vanish from every time series.

Do not derive one figure from two others (e.g. "credits consumed" as
`awarded − outstanding`) unless nothing else can overwrite either input. If a
renewal `$set`s a balance, that identity is false. Report independent facts.

## Mutations

Order of implementation, easiest to hairiest:

**a) Reversible flags** (verify, feature-toggle). Trivial, and they prove the
whole write path end to end.

**b) Block / unblock.** Also revoke the refresh token so the block takes effect
immediately rather than at token expiry. Guard rails: 400 on self-block, 403 on
blocking another admin. **`isActive` is usually a separate axis**: blocking
does not set it and unblocking does not clear it, so a legacy inactive user
stays locked out after "unblock". Return that fact and render it.

**c) Counters and balances.** Atomic `$inc` with a `$gte` guard so a balance
cannot go negative. For an absolute `set`, require `expectedCurrent` as an
optimistic lock, otherwise it races normal consumption and silently refunds
spent credit. If a subscription renewal `$set`s the same field, a manual grant
is *volatile*, return a `warning` and surface it in the confirm dialog rather
than letting the admin discover it a month later.

**d) Status/verdict overrides.** Three traps:
  - Existing repository finders are user-scoped; admin needs unscoped ones.
  - **Write history entries under the OWNER's id, not the admin's.** History is
    usually queried as `{record, user}`, so an admin-attributed entry is
    invisible in the owner's own history. Put the actor in a metadata field.
  - **The override is revertible by the system.** Any poller or webhook that
    `$set`s status from an upstream source will quietly undo it on the next
    callback. Add an `adminVerdictLockedAt`-style field and short-circuit those
    writes, and suppress the user-facing notification too, or the customer
    gets told about a change that was not applied.

**e) Re-triggering an external job.** Guard clauses like "already in progress"
usually block the admin path entirely. Widen the internal method with
`{consumeCredit, notify}` options defaulting to today's behaviour rather than
duplicating it. Re-submitting typically orphans the previous external task id,
keep the old ids so a late callback can still be resolved. And never bill the
customer for an admin-initiated retry.

**Audit everything.** Actor, action, target, before, after, reason, written
best-effort so an audit failure never fails the mutation.

## Two schema-level traps

**Seed scripts delete admin-created rows.** A catalog seeder that ends with
`deleteMany({externalId: {$nin: seedIds}})` destroys everything the admin
created, and its upsert reverts admin edits to seeded rows. Add a
`source: 'seed' | 'admin'` field, exclude `source: 'admin'` from the delete,
and `$setOnInsert` the provenance. `{$ne: 'admin'}` also matches documents
where the field is absent, so no migration is needed.

**Deletes should be soft where names are foreign keys.** If other collections
store a *name string* rather than a reference, a hard delete orphans them
silently. Soft-delete and return the blast radius so the admin sees what they
affected.

## Operational notes

- **Add indexes for admin filters.** They rarely exist: the app only ever
  queried by owner. At minimum index the status+createdAt pairs the panel
  filters on, and any external-id field a webhook looks up. That last one is
  often an unindexed collection scan on *every* callback already.
- **One session per user.** If the refresh-token collection has a unique index
  on `user`, an admin logging into the panel kills their own mobile session and
  vice versa. Use a dedicated admin account. The real fix needs a client
  discriminator and manually dropping the existing index, Mongoose will not
  replace a conflicting index on an existing collection.
- **Rate limits apply to `/auth/refresh-token`, not just login.** With a short
  access TTL and several tabs, 429s are easy to hit. The scaffold's
  single-flight queue is the mitigation; consider a larger bucket for admin
  routes.
- **Swagger auto-tags by first path segment**, collapsing every admin route
  into one "Admin" tag. Set explicit `@ApiTags('Admin · Users')` etc.
- **A "deleted records" view may always be empty** if deletion is implemented
  as a hard delete despite soft-delete fields existing on the schema. Check
  before building the tab.
