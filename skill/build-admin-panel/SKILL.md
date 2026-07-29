---
name: build-admin-panel
description: >-
  This skill should be used when the user asks to build, add, or scope an
  admin panel, admin dashboard, backoffice, or CMS for an existing app or
  platform, e.g. "build an admin panel for this app", "we need a dashboard
  to manage users and orders", "add a backoffice for the backend", "create
  an admin panel like we did for X", or "research this app so we can scope
  an admin panel". Also applies when asked to research an app's frontend/
  mobile + backend codebase specifically to figure out what an admin panel
  would need to manage, and when adding a new entity/page to an admin panel
  that was built with this skill.
---

# Build an admin panel

This skill is self-contained. It ships its own production-grade frontend
scaffold, its own backend drop-in files, and its own verification harness. No
reference project needs to be supplied. Everything under `assets/` came out of
a shipped panel and is verified to build and run.

Building an admin panel is two jobs in order: **understand the target app well
enough to know what an admin actually needs to control**, then **build and
prove it works**. Skipping to code is the single biggest source of rework.
Nearly every hard problem here (wrong response shape, a mutation that silently
ignores the target user, no way to log in at all) is a research gap that
surfaces late, not a coding mistake.

## The five things that go wrong every time

Read these before starting. Each has burned a real build, each is invisible
until late, and each is cheap to avoid up front.

1. **The response envelope.** Get it wrong and lists still return HTTP 200 with
   a plausible body; pagination just silently never works. Read the actual
   interceptor source, then verify one real endpoint with `curl` before
   building anything else on the pattern.
2. **No admin account exists.** A fresh database has zero users. Nothing in the
   panel is reachable until a seed script runs against *that specific*
   database. Deploying code never creates rows.
3. **Secret leakage through admin reads.** Schemas usually mark only `password`
   as non-selectable. OTPs and reset tokens come back by default, and the panel
   renders them into the browser's network tab. Only reading raw JSON catches
   it.
4. **Mutations that look supported but aren't.** A guard can allow `admin`
   while the service still hard-codes the owner from the JWT, ignoring any
   target-user field the DTO accepts. Only the service body reveals this.
5. **"It compiles" proves nothing.** A page returns 200 while every JS chunk
   404s and the app never hydrates. Only a real browser catches that.

## Phase 1: Research the target app

Do not write implementation code yet.

1. Identify the shape: monorepo vs. separate repos, mobile app + API, one
   backend serving several clients.
2. Spawn 1 to 3 parallel read-only Explore agents across backend and
   frontend/mobile *in the same pass*. Read **schemas, DTOs, guards, and
   service bodies**. A route list tells you an endpoint exists, not that it
   ignores `ownerId`, or that a unique index 409s on the second create.
3. Find the **response envelope and pagination shape** by reading the
   interceptor, not by inferring from one example response. Highest-leverage
   thing to get right, and the cheapest to get wrong.
4. Note what admin capability already exists. A `role: 'admin'` enum value with
   no endpoints behind it is common and means you are building the first admin
   surface from scratch, which changes scope expectations.

Full checklist in `references/research-and-scope.md`. Read it before Phase 1 on
anything non-trivial.

## Phase 2: Surface scope decisions

A handful of judgment calls set the size of the whole project. Get them from
the user with `AskUserQuestion`. Guessing wrong here means discarding
finished work, not adjusting it:

- **Are backend changes in scope?** Almost always required: most backends only
  expose owner-scoped lists. If the user wants frontend-only, say plainly that
  the panel can then only show what one admin's own account can already see.
- **Full coverage or phased core-first?** Enumerate the entities found in
  Phase 1 so they choose from a concrete list.
- **Standalone panel or embedded in the existing repo?**
- **For every user-owned entity: can an admin act on behalf of another user?**
  Pick an existing user, or provision one inline?
- **File/image uploads**: paste-a-URL for v1, or wire the real pipeline now?
- **Sub-resources** (gates under a venue, variants under a product): include or
  explicitly defer?

Wording and reasoning for each: `references/research-and-scope.md`.

## Phase 3: Plan, then scaffold

Write a **phased delivery plan**, not one large change:

- **Phase 0, backend prep:** Guards, and the admin seed script.
- **Phase 1, auth + dashboard + one core entity:** verified end to end before
  anything else. This catches envelope/CORS/auth mistakes while there is only
  one module to debug.
- **Phase 2 onward, one domain per phase:** each independently verifiable.

Then scaffold the frontend:

```bash
scripts/create-panel.sh --dest <path> --name "Acme" --hue 160 \
                        --api http://localhost:4000 --install
```

This produces a complete, typechecking Next.js 15 panel: axios with a
single-flight 401-refresh queue, persisted auth store with a hydration flag,
app shell, login, dashboard, a worked entity page to clone, and `verify.js`.
Stack and conventions: `references/stack-and-conventions.md`.

Immediately after scaffolding, in this order:

1. Fix `ApiEnvelope` in `src/types/index.ts` and the unwrap helpers in
   `src/lib/api.ts` against the real interceptor.
2. Fix the login field in `src/services/auth.ts` (`email` vs `identifier`).
3. Point `NEXT_PUBLIC_API_URL` at the backend and add the panel's origin to
   backend CORS.

Backend work goes in one new `src/modules/admin/` module reusing existing
services and repositories. Drop-in files and the full API pattern:
`references/backend-admin-api.md`. The bundled backend files are NestJS +
Mongoose; if the target is Django, Rails, Laravel or Express, read
`references/other-stacks.md` for the concept map. The frontend scaffold is
unaffected either way.

## Phase 4: Build phase by phase

Add entities by cloning the worked trio: service hooks, page, detail dialog.
Recipes, conventions and the per-entity checklist:
`references/frontend-recipes.md`.

Ship mutations in ascending order of risk: reversible flags first
(verify/block), then counters and money, then anything an upstream process can
overwrite. Typecheck **both** sides after each phase; do not let errors
accumulate.

## Phase 5: Verify for real

A clean typecheck and a clean build are necessary and nowhere near sufficient.

1. Stand up real local infra (containerised DB/cache) from the actual
   `.env.example` rather than guessing values.
2. **Run the admin seed script.**
3. `curl` one list endpoint and read the **raw JSON**: pagination in the right
   place, and no token/OTP fields anywhere in the payload.
4. Drive a real browser: `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run verify`.
   It logs in, sweeps every sidebar page, opens a detail dialog, performs
   **one real write**, and logs out, failing on console errors or failed API
   calls.
5. Confirm the write landed in the database, not just that a toast appeared.

Gotcha list, the pre-ship checklist, and verification detail:
`references/build-and-verify.md`.

## Phase 6: Deploy, if asked

Reuse the app's existing CI/CD. CORS needs the new origin explicitly. **Seeding
is a separate step from deploying.** New code never creates rows, so a login
failure after a "successful" deploy usually means the seed has not run against
that environment. Re-run the browser verification against the real URL.

Details, including default-branch restrictions: `references/deploy.md`.

## Reference files

- **`references/research-and-scope.md`**: discovery checklist and the standard
  scoping questions with reasoning.
- **`references/stack-and-conventions.md`**: the canonical stack, what each
  scaffolded file does, and the house conventions to follow.
- **`references/backend-admin-api.md`**: admin module layout, security
  projection, query/filter safety, stats aggregation, mutation patterns.
- **`references/frontend-recipes.md`**: adding an entity, dialogs, filters,
  charts, and the per-entity checklist.
- **`references/build-and-verify.md`**: the full gotcha list and the
  verification playbook.
- **`references/other-stacks.md`**: what changes when the backend is not
  NestJS + Mongo (Django, Rails, Laravel, Express + Prisma).
- **`references/deploy.md`**: deployment, CORS, seeding a live environment.

## Assets

- **`assets/frontend/`**: the complete panel template. Runs and builds as-is.
- **`assets/backend/nest/`**: guards, decorators, safe projection, audit log,
  and the admin seed script. See its README for wiring order.
- **`scripts/create-panel.sh`**: scaffolds and rebrands a new panel.
