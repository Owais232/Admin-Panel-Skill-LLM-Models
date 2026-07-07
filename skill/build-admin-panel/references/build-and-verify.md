# Build pattern, gotchas, and verification playbook

## Backend admin-module skeleton

A single new module, not scattered changes across every existing module:

```
<backend>/src/modules/admin/
├── admin.module.ts
├── dto/
│   ├── admin-<entity>-query.dto.ts   (extends the existing pagination DTO;
│   │                                   adds search/filter fields per entity)
│   └── ...
├── admin-dashboard.controller.ts / admin-dashboard.service.ts
├── admin-<domain>.controller.ts / admin-<domain>.service.ts   (one pair per
│                                                                related group
│                                                                of entities)
└── ...
```

Conventions:

- Every controller: class-level auth guard + role guard, e.g.
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')`, so nothing in
  this module is reachable without both.
- Cross-tenant reads inject the relevant models/repositories directly and
  reuse the existing pagination utility; no need to touch the owner-scoped
  services just to add a list endpoint.
- Mutations (block/unblock, moderate, soft-delete) should reuse an existing
  owner-scoped service method where the guard already permits `admin` and
  the service bypasses the ownership check for that role. Verify this
  case-by-case by reading the service, not by assuming consistency: the
  same codebase can have some entities where admin already bypasses
  ownership and others where it doesn't.
- Every list/detail response must match the envelope contract found during
  research exactly. This is worth a comment at the top of the module
  reminding future editors what shape is required and why.

## Frontend skeleton

- One `services/<entity>.ts` file per entity: typed query/mutation hooks,
  a shared `invalidate(queryClient)` helper called by every mutation's
  `onSuccess`.
- One `app/.../<entity>/page.tsx` per entity: search/filter inputs, a
  generic reusable data-table component, a create/edit dialog reusing the
  same dialog shape across the whole panel (one field per `useState`, an
  effect that seeds fields from the entity being edited, a mutation call in
  `handleSubmit`, toast on success/error, disable-and-spin the submit button
  while pending).
- Sidebar grouped by domain (e.g. "People", "Content", "Finance") rather
  than one flat list, which makes the IA legible as the entity count grows
  past half a dozen.

## Gotchas

**The envelope trap.** An admin list handler that returns a shape adjacent
to, but not exactly, what the response-wrapping middleware expects will
often still return HTTP 200 with a body that *looks* plausible, just with
`meta`/pagination data in the wrong place. This fails silently in the
frontend (pagination controls just don't work) rather than throwing
anywhere. Always verify one real endpoint end-to-end (curl + inspect the
raw JSON) before building the rest on the same pattern.

**CORS for every new origin.** A local dev frontend, a deployed frontend,
and a preview-deployment domain are three different origins. Backend CORS
config needs each one added explicitly (or a regex for preview URLs). A
"works locally, 400/network-error in production" symptom after deploy is
almost always this, not a code bug. Test with a real preflight/response
check (`curl -H "Origin: <origin>" <url> | grep -i access-control`), not
just by eyeballing the config file, since the config might list an origin
that doesn't match a trailing slash, protocol, or port exactly.

**Dev-server vs. build cache corruption.** Running a production build
command in the same project directory as a running dev server can wipe out
the dev server's build artifacts out from under it. The result: the page
still returns HTTP 200 (it's serving a cached HTML shell), but every JS/CSS
chunk 404s, so the app never hydrates and appears stuck on a loading
screen forever. This looks exactly like a broken auth guard. If a
previously-working local panel suddenly won't get past "Loading…", check
for 404s on static assets in the browser console before debugging auth
logic. Kill both processes, clear the build output directory, and restart
clean.

**Seed vs. deploy are different operations.** Deploying new backend code
changes what the server *can* do; it never inserts rows into the database.
A freshly deployed environment (or a fresh database) has no admin account
until a seed step runs against that specific database. After a "successful"
deploy, a login attempt returning "incorrect email or password" is not a
deploy failure: it means the seed step hasn't run yet against that
environment. Keep these as visibly separate steps in any deployment
checklist, and confirm login only after explicitly running the seed.

**Default-branch CI restrictions.** In this environment, pushing to (or
opening a PR that would modify) a repository's default branch commonly
requires the human's own direct action, even for something as
low-consequence-looking as registering a new CI workflow file so it can be
manually dispatched. If blocked here, don't retry through alternate paths
(a fresh branch, a worktree, editing a different file to the same effect).
That's treated as circumventing the same restriction, not solving a
different problem. Explain what's needed and hand back one exact command
for the human to run themselves.

## Verification playbook

Compiling and typechecking cleanly is necessary, not sufficient. Before
calling a phase done:

1. **Stand up real local infra.** Read the actual `.env.example` rather
   than guessing values; if the backend needs a database/cache, run it in
   a local container rather than trying to fake it out.
2. **Seed the first admin account** through the backend's own script/flow.
   A fresh database has zero users: there is no way to log in until this
   runs, and it's easy to forget since it's outside the normal edit/build
   loop.
3. **Drive a real browser.** A curl-only check will report HTTP 200 on the
   HTML shell even when every JavaScript chunk is 404ing and the app never
   actually renders; it cannot catch a stuck-loading state. Use Playwright
   (or equivalent) to:
   - log in with the seeded credentials and assert the post-login URL,
   - sweep every page in the sidebar, asserting each one's heading appears
     and no fullscreen "Loading…" state persists after a short wait,
   - open at least one detail dialog and confirm it populates,
   - perform at least one real write through the UI (not just a page load),
     e.g. toggle a status or save a settings field, and assert the
     success toast/resulting state change,
   - log out and confirm the redirect back to the login page,
   - collect console errors and failed network requests throughout, not
     just page-load HTTP status, and fail the check if either is non-empty.
4. **Screenshot the result.** A full-page screenshot of the rendered
   dashboard is worth more as evidence than any amount of prose describing
   that it "works."

A minimal reusable Playwright skeleton for step 3 (adapt selectors/URLs):

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('requestfailed', (r) => failedRequests.push(r.url()));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) failedRequests.push(`${r.status()} ${r.url()}`);
  });

  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle' });
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  for (const [path, heading] of PAGES) {
    await page.goto(BASE_URL + path, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(`h1:has-text("${heading}")`, { timeout: 12000 });
    await page.waitForTimeout(800);
    if (await page.locator('text=Loading…').count() > 0) {
      console.log('STUCK LOADING:', path);
    }
  }

  // ...one real mutation through the UI here (fill a form, click submit,
  // wait for the success toast)...

  await page.screenshot({ path: 'dashboard.png', fullPage: true });
  console.log('console errors:', consoleErrors.length, 'failed requests:', failedRequests.length);
  await browser.close();
})();
```

Run this against `localhost` after each phase, and again against the real
public URL after any deploy. A working local panel proves nothing about
CORS or environment configuration in production.
