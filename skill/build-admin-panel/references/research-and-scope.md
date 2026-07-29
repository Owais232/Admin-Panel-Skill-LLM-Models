# Research checklist and scoping questions

## What to read in the backend

Do not stop at a route/controller listing. For every entity the panel might
manage, read:

- **The schema itself**: every field; which are required; which carry
  uniqueness constraints (including *partial* unique indexes, e.g. "one active
  record per owner", which 409 only on the second create); which reference
  other collections; which are system-managed and never client-settable
  (counters, ratings, soft-delete flags).
- **The create/update DTOs**: the validators, not just the field names. A
  field optional in the DTO but required by a downstream rule (an image URL
  required only once status is `published`) is a standard trap.
- **The controller's guards**: which roles can call each endpoint, and whether
  `admin` is in the allow-list at all. Backends built for a self-service flow
  routinely gate create/update to exactly one non-admin role, with no path for
  an admin to act on behalf of anyone. Record this as required backend work
  rather than assuming it will work once the frontend calls it.
- **The service body, not just the guard.** A guard can allow `admin` while the
  service still hard-codes `owner: request.user.userId` from the JWT, silently
  ignoring any target-user field the DTO accepts. The endpoint *looks* like it
  supports admin-on-behalf-of creation and does not. Only the method body shows
  this.
- **The response envelope**: the interceptor source, not one example
  response. If it branches on the returned shape, work out which branch your
  new endpoints must hit. Getting this wrong yields a response that parses fine
  and misplaces `meta`, breaking pagination with no error anywhere.
- **The pagination utility**, and reuse it rather than hand-rolling skip/limit
  that may not match the expected meta shape.
- **The auth system**: how tokens are issued, what the JWT payload holds,
  whether a `Roles`/`RolesGuard` pair already exists to reuse, and whether any
  module uses an inline `if (user.role !== 'admin')` check instead. Those are
  worth normalising to the guard while you are in there, but check each one
  before enabling it. An inline check that is currently *commented out* is
  load-bearing: turning it on can 403 a client that depends on the endpoint
  being open.
- **Whether the refresh-token collection is unique per user**: that decides
  whether an admin can use the panel and the mobile app with one account.
- **Which indexes exist.** Usually none that match admin filters, because the
  app only ever queried by owner.

## What to read in the frontend/mobile app

- Which entities are backed by real API calls vs. still hardcoded mock arrays.
  The panel manages the real backend entities; mocks are useful only as a rough
  field-list orientation.
- **Creation flows**, especially multi-step ones. A profile-style entity is
  often created across several screens with a client-side draft, and the final
  submit may fire more than one call (create parent, then N sub-resource
  calls). A panel that calls only the parent endpoint produces silently
  incomplete records.
- **Invite/onboarding flows**: check what they actually provision. "Invite
  user" commonly creates a bare user with a role and no profile document; the
  invitee still has to complete onboarding. Also check every role that needs a
  profile is invitable at all, invite systems are built incrementally and
  routinely miss one.
- **Upload dependencies**: if a required field is a hosted URL rather than an
  arbitrary string, the panel's form needs a working upload path or a URL-paste
  fallback before submission can succeed at all.
- **Admin remnants**: an `admin` role with zero UI referencing it means you
  are building the first admin surface from scratch, which sets expectations.
- **Dead files that are actually data.** A large unreferenced JSON in the repo
  is often a full upstream catalog that a seeder trimmed. Worth checking before
  building a manual data-entry screen for something already sitting on disk.

## Scoping questions (via AskUserQuestion)

Ask these once Phase 1 research is done, before designing anything. Each
materially changes scope; none should be defaulted silently.

1. **"Backend changes in scope, or frontend-only?"**
   Almost every backend built for a self-service app has only owner-scoped
   lists. If the user says frontend-only, the honest answer is "then the panel
   can only show what one admin's own account already sees", say that plainly
   rather than quietly building against endpoints that do not exist.

2. **"Full coverage, or phased core-first?"**
   Enumerate every entity found in Phase 1 so they choose from a concrete list.
   Recommend phased with users + dashboard first, since nothing else is useful
   without them.

3. **"New standalone project, or embedded in the existing repo?"**
   Affects deployment topology and CI reuse. Standalone is the default here,
   the scaffold is a complete project.

4. **For any user-owned entity: "Can an admin create a record for another
   user, and how is the owner chosen?"**
   This is new backend logic in the overwhelming majority of codebases. Offer
   concrete options: (a) pick from existing users with the right role, via
   search, smallest footprint; (b) provision a new user inline, bigger, and
   usually means wiring in the invite system.

5. **"How are image/file uploads handled in create/edit forms?"**
   The real pipeline usually exists for the mobile client and can be reused,
   but wiring it into a new form is real work. A URL-paste input is a
   legitimate v1 that unblocks everything else. Offer both.

6. **For any sub-resource found in Phase 1: "Manage it now, or defer?"**
   A summary field on the parent (`numberOfGates`) is often a number someone
   typed with no enforcement against actual sub-records. Creating the parent
   alone from the panel produces a valid-but-hollow record. Surface it so the
   deferral is a decision rather than an oversight.

7. **If a needed role turns out not to be invitable: "Add it as an invitable
   role (usually small and low-risk), or out of scope?"**

## Confirm the bug before fixing it

When the request arrives as a list of reported problems rather than a feature,
reproduce each one against the real system before planning any fix. Reports
routinely mis-describe the cause: "the dropdown is blank" turned out to be
16 of 24 records having no image at all, plus a renderer that could not display
the format the other 8 used. Fixing the reported symptom would have addressed
neither.

State plainly which reported issues you confirmed, which you could not
reproduce, and what the actual cause was, before proposing the fix.
