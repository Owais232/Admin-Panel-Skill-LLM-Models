# Research checklist + standard scoping questions

## What to read in the backend

Don't stop at a route/controller listing. For each entity the admin panel
might need to manage, read:

- **The schema/model file itself:** every field, which are required,
  which have uniqueness constraints (e.g. "one active venue per owner" via a
  partial unique index), which reference other collections (taxonomy/
  category tables, other entities), which fields are system-managed and
  never client-settable (ratings, counters, soft-delete flags).
- **The create/update DTOs:** exact validators, not just field names. A
  field being "optional" in the DTO but required by a downstream business
  rule (e.g. an image URL required only when a certain status is set) is a
  common trap.
- **The controller's guards:** which roles can call each endpoint, and
  critically, whether an "admin" role is even in the allow-list at all.
  Backends built for a single-tenant self-service flow (mobile app users
  managing their own data) frequently have create/update endpoints gated to
  exactly one non-admin role, with zero path for an admin to act on behalf
  of another user. Note this as a required backend change rather than
  assuming it'll "just work" once the frontend calls it.
- **The service's business logic**, not just the guard: a guard can allow
  a role while the service still hard-codes `owner: request.user.userId`
  from the JWT, silently ignoring any "target user" field the DTO accepts.
  This makes an endpoint *look* like it supports admin-on-behalf-of
  creation when it actually doesn't. Only reading the service method body
  reveals this.
- **The exact response envelope:** read the interceptor/middleware that
  wraps every response, not just one example endpoint's output. Common
  shapes: `{ success, data, meta }`, `{ data: { items, meta } }`, a bare
  array with `X-Total-Count` header, etc. If the wrapper has more than one
  branch (e.g. "if payload looks like `{items, meta}` do X, else if it looks
  like `{data, meta}` do Y, else wrap plainly"), figure out which branch
  your new endpoints need to hit. Getting this wrong produces a response
  that *parses* fine but silently misplaces `meta`, breaking pagination in
  the frontend with no error thrown anywhere.
- **The pagination utility**, if one exists, and reuse it rather than
  hand-rolling skip/limit math that might not match the frontend's expected
  `PaginationMeta` shape exactly.
- **The auth/role system**: how tokens are issued, what a JWT payload
  contains, whether there's a generic `Roles`/`RolesGuard` decorator pair to
  reuse for new admin endpoints, and whether any existing modules use an
  inline `if (user.role !== 'admin') throw ...` check instead of the guard.
  These are worth normalizing to the guard pattern while you're in there,
  since it's a small fix that makes every future admin endpoint consistent.
- **Whether any admin-only capability already exists** in the backend at
  all (a role that's recognized but has no real endpoints yet is common:
  it means you're building from scratch, not extending).

## What to read in the frontend/mobile app

- Which entities are backed by real API calls vs. still hardcoded local
  arrays/mock data: the admin panel should manage the real backend
  entities, not the mock shapes, even if the mocks are more convenient to
  read first as a rough field-list orientation.
- The **creation flows** for entities the admin will need to create or
  edit, especially multi-step ones. A profile-style entity (e.g. a venue,
  a vendor, a listing) is often created across several screens with a
  client-side draft, and the *final* submit step may fire more than one API
  call (e.g. create the parent entity, then loop over a sub-resource array
  making N follow-up calls). If the admin panel only calls the "create
  parent" endpoint, it will silently produce incomplete records. Flag this
  explicitly rather than assuming one endpoint covers a mobile flow that
  visibly spans several screens.
- Any **invite/onboarding flow**: check exactly what it provisions. It's
  common for an "invite user" flow to create a bare user record with a role
  set, but never the actual profile/entity document, so the invited user
  still has to complete their own onboarding after accepting. Don't assume
  accepting an invite finishes the job.
- Whether every role that needs a profile entity is actually **invitable**
  at all: invite systems are often built incrementally and can be missing
  a role (e.g. three of four provider types are invitable, the fourth isn't
  yet) purely because nobody needed it until now.
- Any existing admin remnants: a role enum that includes "admin" with zero
  UI anywhere referencing it is a strong signal you're building the first
  admin surface from scratch, which matters for scope-setting expectations.
- File/image upload dependency: if a required field is a hosted URL
  (rather than an arbitrary string), the admin panel's create/edit form
  needs either a working upload pipeline or a URL-paste fallback before
  submission can succeed at all; note which fields are actually required
  vs. optional.

## Finding and evaluating sibling reference templates

If the organization has built other admin panels before, look for them as
sibling directories/repos. Worth cloning if they share:

- The same broad stack (framework, UI library, data-fetching approach).
- A generic data-table component, a generic form-dialog convention, and a
  persisted-auth-store pattern that's already solved the "block writing the
  same auth interceptor from scratch" problem (token refresh queuing,
  401-retry, etc.).

If found, clone the richer/more complete one as the skeleton, strip its
domain-specific pages/services down to the auth+layout scaffolding, and
build the new entities on top of the same conventions. This keeps the
whole organization's admin panels feeling like one family rather than N
independent one-offs.

## Standard scoping questions to ask (via AskUserQuestion)

Ask these together once Phase 1 research is done, before designing
anything. Each one materially changes scope, so don't default silently.

1. **"Should backend changes be in scope, or frontend-only?"**
   Reasoning: almost every backend built for a self-service app only has
   owner-scoped list endpoints. A real admin panel needs cross-tenant
   list/detail endpoints that don't exist yet. If the user says
   frontend-only, the honest answer is "then the panel can only show what
   each admin's own account can already see." Say that plainly rather than
   quietly building against endpoints that don't exist.

2. **"Full coverage of every entity, or a phased/core-first subset?"**
   Reasoning: enumerate every entity discovered in Phase 1 so the user is
   choosing from a concrete list, not an abstract "everything." Recommend
   phased-with-core-first as the default (dashboard + user management first,
   since nothing else is useful without them) but let the user pick breadth.

3. **"New standalone project, or embedded in the existing repo?"**
   Reasoning: matters for deployment topology, CI/CD reuse, and whether a
   sibling reference template's project layout should be cloned wholesale
   (favors standalone) vs. merged into existing tooling (favors embedded).

4. **For any entity that belongs to a user/tenant: "Can an admin create a
   record for another user, and if so, how is the owner chosen?"**
   Reasoning: this is new backend logic in the overwhelming majority of
   codebases (see the research checklist above; even endpoints that
   technically allow an admin role often ignore any owner-override field).
   Present the real options concretely: (a) admin picks from existing users
   who already have the right role, via search (the smallest new-logic
   footprint); (b) admin can also provision a brand-new user inline (bigger
   scope: usually means wiring the invite system in, plus checking every
   needed role is actually invitable).

5. **"How should image/file uploads be handled in create/edit forms?"**
   Reasoning: real upload pipelines (presigned URLs, S3, etc.) are usually
   already built for the mobile/web client and can be reused, but wiring
   them into a new admin form is real work. A plain URL-paste input is a
   legitimate, much smaller v1 that unblocks everything else. Offer both
   explicitly rather than assuming the richer option by default.

6. **For any entity with a side-flow sub-resource discovered in Phase 1
   (e.g. "gates" under a "venue", "variants" under a "product"): "Include
   this sub-resource's management now, or defer it?"**
   Reasoning: a summary field on the parent (e.g. `numberOfGates`) is
   often just a number typed by the original creator with zero
   enforcement against actual sub-resource records. Creating the parent
   alone from the admin panel will produce a technically-valid-but-hollow
   record unless the sub-resource is handled too. Surface this explicitly
   so the user can choose to include it or knowingly defer it.

7. **If a needed role turns out not to be invitable yet (see research
   checklist): "Should we add it as an invitable role (usually a small,
   low-risk backend change), or is that out of scope for now?"**
