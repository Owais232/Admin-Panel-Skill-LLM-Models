# Deploying the panel

## Order of operations

1. Deploy the backend changes (admin module, guards, CORS).
2. Add the panel's production origin to backend CORS, **and its preview
   origins** if the host generates per-deployment URLs. Verify with a real
   preflight, not by reading the config.
3. Deploy the frontend with `NEXT_PUBLIC_API_URL` set to the public API origin.
   It is inlined at build time, so changing it later requires a rebuild, not a
   restart.
4. **Seed the admin account against that environment's database.** Separate
   step. Deploying code never creates rows.
5. Re-run the browser verification against the real URL.

Step 4 is where deployments are declared finished and then reported broken.
Login returning "incorrect email or password" on a fresh environment is an
empty users collection, not a bug.

## Reuse the existing pipeline

Whatever the app already uses for CI/CD, use that. A second deployment
mechanism for a panel that nobody deploys weekly is a maintenance liability.

If the host runs `next build` with `output: 'standalone'`, confirm
`outputFileTracingRoot` still resolves correctly from the build context, the
scaffold pins it to its own directory.

## Restrictions to expect

Pushing to a non-default branch is usually unrestricted. Writing to or merging
into the **default branch** commonly requires the human's own direct action.
If blocked, do not route around it via a different branch, a worktree, or an
equivalent edit somewhere else. That is the same restriction, and treating
it as a puzzle to solve is the wrong read. Explain what is needed and hand back
one exact command to run.

## Production hardening worth doing before handover

- Narrow `images.remotePatterns` in `next.config.mjs` from `**` to the real
  bucket hostname.
- Confirm the admin account used by the panel is **not** an account anyone uses
  on the mobile app, if the backend keeps one session per user.
- Check the access-token TTL against how long an admin actually sits on a page.
  A 15-minute TTL with a rate-limited refresh endpoint is a bad combination for
  someone leaving a dashboard open.
- Make sure the audit log is actually being written in production. It is
  best-effort by design, so a misconfigured collection fails silently and
  nobody notices until they need it.
