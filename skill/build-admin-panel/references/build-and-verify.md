# Gotchas and the verification playbook

## Gotchas

**The envelope trap.** An admin list handler returning a shape adjacent to,
but not exactly, what the response wrapper expects will still return HTTP 200
with a plausible body, just with `meta` in the wrong place. It fails silently
in the frontend (pagination controls never appear) rather than throwing
anywhere. Always `curl` one real endpoint and read the raw JSON before building
the rest on the same pattern.

**Secrets in admin reads.** Covered in `backend-admin-api.md`, repeated here
because it is the highest-severity item in this document: read the raw JSON of
a user response and confirm no OTP, reset token, or verification token is in
it. The UI never shows these fields, so nothing about the working panel reveals
the leak.

**CORS for every new origin.** A local dev frontend, a deployed frontend and a
preview URL are three different origins, each needing an explicit entry. Test
with a real preflight rather than eyeballing the config, since a trailing
slash, protocol or port mismatch fails silently:

```bash
curl -s -i -X OPTIONS <api>/auth/login \
  -H 'Origin: http://localhost:3001' \
  -H 'Access-Control-Request-Method: POST' | grep -i 'access-control\|^HTTP'
```

A **missing `Access-Control-Allow-Origin` in the response is the failure**: 
the status is still `204`, so checking the status code alone tells you nothing.
In the browser this presents as a login form that does nothing on submit while
the endpoint works perfectly under `curl`.

**Dev-server vs. build-cache corruption.** Running a production build in the
same directory as a running dev server wipes the dev server's artifacts out
from under it. The page still returns 200 (it serves a cached HTML shell) but
every JS chunk 404s, so the app never hydrates and sits on "Loading…" forever
, identical in appearance to a broken auth guard. Before debugging auth, check
the console for 404s on static assets. Fix: stop both, delete the build output
directory, restart.

**Moving a panel between directories** leaves absolute paths in the build
cache. Delete it after any move.

**Seed vs. deploy are different operations.** Deploying changes what the server
*can* do; it never inserts rows. After a successful deploy, "incorrect email or
password" means the seed has not run against that environment's database.

**Default-branch CI restrictions.** Pushing to (or opening a PR that modifies)
a repository's default branch commonly requires the human's own action, even
for something as innocuous as registering a workflow file. If blocked, do not
retry through a different branch, a worktree, or an equivalent edit elsewhere,
that is circumventing the same restriction. Explain what is needed and hand
back one exact command.

## Verification playbook

Compiling cleanly is necessary, not sufficient. Before calling a phase done:

1. **Stand up real local infra** from the actual `.env.example`, containerised
   DB/cache, not mocks. Pick non-default host ports if the machine already runs
   other projects' containers.
2. **Seed the first admin account.** Nothing else is reachable until this runs.
3. **`curl` one list endpoint** and read the raw JSON: pagination in the
   expected place, no secret fields present.
4. **Drive a real browser.** The scaffold ships `verify.js`:

   ```bash
   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='…' \
     VERIFY_WRITE_EMAIL=staff@example.com npm run verify
   ```

   It logs in, sweeps every sidebar page asserting the heading renders and no
   persistent "Loading…" remains, opens a detail dialog, checks a search
   empty-state, performs a **real write and then reverses it**, screenshots the
   dashboard, and logs out, failing on console errors or failed API calls,
   while reporting benign asset failures separately.

   Warm the routes first (`curl` each page once) or the first run times out
   while Next compiles on demand, a compile delay, not a failure.
5. **Confirm the write in the database.** A success toast proves the request
   returned 200, not that the record changed. Query it, and check the audit log
   recorded actor, before and after.
6. **Screenshot the dashboard** as evidence.

## Verifying your own tests

Two of these checks have silently passed while proving nothing. Both are worth
guarding against explicitly:

- **A test whose fixtures make it vacuous.** Asserting that history is written
  under the record owner's id passes trivially if the record's owner *is* the
  admin performing the action. Set up the fixture so the two differ, then
  assert both directions: right id matches, wrong id does not.
- **A test whose payload the system ignores.** Posting a webhook with the wrong
  envelope key means the handler discards it and the assertion "nothing
  changed" passes for entirely the wrong reason. Confirm the system *received*
  what you sent, a log line, a state change, anything, before trusting a
  negative result.

When a test passes on the first attempt for something subtle, make it fail on
purpose once. A check that cannot fail is not a check.

## Pre-ship checklist

Run this before calling a panel done. Each line has failed a real build.

**Security**

- [ ] Raw JSON of a user response contains no OTP, reset, verification or
      delete token.
- [ ] Every `populate`/join of a user reference has an explicit field list.
- [ ] Every admin route is behind both guards, in the right order.
- [ ] Self-targeting mutations are blocked (no self-block, no self-demote).
- [ ] Admin-on-admin destructive actions are blocked or deliberately allowed.

**Correctness**

- [ ] One list endpoint verified by reading raw JSON, not just status code.
- [ ] Pagination works past page 1, and a filter change resets to page 1.
- [ ] Booleans filter correctly for `false`, not just `true`.
- [ ] A search term containing a regex metacharacter does not 500.
- [ ] Sort fields are whitelisted.
- [ ] Money is grouped by currency; refund signs verified against real rows.
- [ ] Date series are zero-filled, and the empty case renders an empty state.

**Operability**

- [ ] Seed script is idempotent and has been run twice.
- [ ] Every mutation writes an audit entry with actor, before and after.
- [ ] Indexes exist for the fields the panel filters and sorts on.
- [ ] CORS verified by preflight for every origin that will be used.

**Proof**

- [ ] Browser run passes with zero console errors and zero API failures.
- [ ] The write it performed was confirmed in the database.
- [ ] Screenshot captured.
