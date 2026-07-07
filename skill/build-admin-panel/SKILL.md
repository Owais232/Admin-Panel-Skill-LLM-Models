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
  would need to manage.
---

Building an admin panel is two distinct jobs done in order: **understand the
target app deeply enough to know what an admin actually needs to control**,
then **build and verify it for real**. Skipping straight to code is the
single biggest source of rework. Almost every hard problem in this kind of
task (wrong response shape, missing owner-creation semantics, no way to log
in) is a research gap that surfaces late instead of a coding mistake.

Work through these six phases in order. Phases 1 and 2 are pure research and
judgment calls, so do not write implementation code yet. Phases 3 to 6 build,
verify, and optionally deploy.

## Phase 1: Research the target app first

Before touching a single scoping question, understand the codebase itself.

1. Identify the shape: monorepo vs. separate frontend/backend repos, mobile
   app + API, one backend serving multiple clients, etc.
2. Spawn 1 to 3 parallel Explore agents (read-only) to research the backend and
   frontend/mobile side in the same pass. Read actual **schemas, DTOs, and
   guard implementations**, not just a list of controller routes. A route
   list tells you an endpoint exists; it doesn't tell you it ignores an
   `ownerId` field, or that a uniqueness index will 409 on the second create,
   or that a role guard silently excludes admin.
3. Find the backend's **response envelope and pagination shape** by reading
   the actual interceptor/response-transform code, not by guessing from
   convention. This is the single highest-leverage thing to get right early:
   every admin list endpoint you write has to match it exactly, and a
   subtly wrong shape (e.g. `{ items, meta }` vs `{ data: { plural, meta } }`)
   fails silently in the frontend instead of erroring loudly.
4. Check for sibling reference admin-panel projects the same organization
   has already built. If one exists, clone its house style (tech stack,
   folder layout, generic table/dialog components, auth-store shape) instead
   of inventing a new one. Consistency across admin panels is worth more
   than a marginally "better" pattern.

Full checklist (entities, auth/roles, existing admin capability, hardcoded
vs. real data, upload dependencies) is in `references/research-and-scope.md`.
Read it before starting Phase 1 on anything non-trivial.

## Phase 2: Surface scope decisions before building

A handful of judgment calls determine the size and shape of the whole
project. Get these from the user via `AskUserQuestion`. Do not silently
assume a default for anything on this list, because guessing wrong here
means throwing away completed work, not just a tweak:

- **Is a backend change in scope?** Most backends only expose owner/tenant-
  scoped list endpoints; a real admin panel almost always needs new
  admin-scoped endpoints. If the user only wants a frontend, say so
  explicitly and scope down what's possible without backend changes.
- **Full surface vs. phased core-first?** Enumerate the entities found in
  Phase 1 and let the user pick breadth before you design pages for all of
  them.
- **New standalone panel project, or embedded in the existing repo?**
- **For every entity that belongs to a user/tenant**: can an admin create a
  record *for* another user? If so, pick from existing users, or provision
  a new one inline? (Most backends have zero support for this on day one;
  it's new logic either way, so it's a real decision, not a technicality.)
- **File/image uploads**: paste-a-URL for v1, or wire the real upload
  pipeline now?
- **Entity-specific side-flows** (e.g. a "venue" that also needs "gates"
  managed as a separate sub-resource): include now or defer explicitly?

The reasoning behind each of these, plus the exact question wording that
works well, is in `references/research-and-scope.md`.

## Phase 3: Design the plan

With research and scope answers in hand:

- Confirm the envelope contract one more time against real code (Phase 1
  step 3) before writing a single admin endpoint.
- Backend: usually one new admin module with per-domain controllers under
  `/admin/*`, reusing existing services/repositories for validation and
  business rules rather than re-implementing them. Cross-tenant list/detail
  endpoints are the main new surface; mutations often can reuse existing
  owner-scoped endpoints if the guard already allows `admin` and bypasses
  the ownership check for that role (check case by case: some do, some
  don't, and it's inconsistent even within one codebase).
- Frontend: sidebar grouped by domain, one service-hook file + one page per
  entity, built on a single reused generic table/dialog convention.
- Write a **phased delivery plan**, not one giant PR:
  - Phase 0, backend prep: guard cleanups, and critically, a script to
    **seed the very first admin account**. This is the thing everyone
    forgets until the end, and nothing else in the panel is testable
    without it.
  - Phase 1, auth + dashboard + one core module (e.g. users), fully built
    and verified end-to-end before continuing. This catches integration
    mistakes (wrong envelope shape, CORS, auth flow) while there's only one
    module to debug, not ten.
  - Phase 2+, one feature domain per phase, each independently verifiable.

## Phase 4: Build phase by phase

- After each phase, typecheck/build **both** sides before moving to the
  next one. Don't let type errors accumulate across phases.
- Known trap: running a production build (`next build`, etc.) in the same
  directory as a live dev server can silently corrupt the dev server's
  build cache. The symptom looks exactly like a broken auth guard (page
  stuck on "Loading…" forever) but is actually every JS chunk 404ing. Stop
  the dev server before building, or use a separate checkout.

## Phase 5: Verify for real, not just "it compiles"

A clean typecheck and a clean build are necessary and not remotely
sufficient. Before calling anything done:

- Stand up whatever local infra the backend needs (containerized DB/cache,
  etc.) rather than guessing env values. Read the actual `.env.example`.
- Run the seed script to create the first admin account. A fresh database
  has zero users; no login is possible until this runs, and this is easy to
  forget since it's a one-time step outside the normal build/test loop.
- Drive an **actual browser** (Playwright or equivalent) through: login,
  every page in the sidebar, opening at least one detail dialog, performing
  at least one real write through the UI (not just a GET), and logout.
  Check console errors and failed network requests, not just HTTP status:
  a page can return 200 while every asset on it 404s.
- Take a full-page screenshot of the working dashboard as visual proof.

The exact verification-script pattern and the full gotcha list (envelope
trap, CORS, build-cache corruption, and others) are in
`references/build-and-verify.md`.

## Phase 6: Deploy, if asked

- Reuse the app's existing CI/CD rather than inventing a new pipeline.
- Pushing to a non-default branch is usually unrestricted; writing to or
  merging into the repository's **default branch** commonly requires the
  human's own direct action in this environment. If blocked here, don't
  spend cycles hunting for a workaround. Explain clearly and hand back one
  crisp command for the user to run themselves.
- CORS almost always needs an explicit backend change for a newly deployed
  frontend origin. Don't assume the existing config already allows it.
- **Seeding a live admin account is a separate step from deploying code.**
  Deploying new code never creates database rows. This is the most common
  point of confusion after a "successful" deploy: login still fails with
  "incorrect email or password" until the seed step runs against that
  specific environment's database.
- After deploying the frontend, re-run the full Playwright verification
  against the real public URL. A working local panel proves nothing about
  CORS or env config in production.

## Reference files

- **`references/research-and-scope.md`**: full discovery checklist (what to
  read in the backend and frontend/mobile) and the standard scoping
  questions with the reasoning behind each.
- **`references/build-and-verify.md`**: the phased build pattern in more
  detail, the full gotcha list, and a reusable Playwright verification
  script skeleton.
