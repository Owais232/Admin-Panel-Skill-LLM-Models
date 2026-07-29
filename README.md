# Build Admin Panel: An Agent Skill for Researching, Building, and Verifying Back-Office Panels

An agent skill that researches an existing app, builds the admin panel it
needs including the backend API, and proves the result works in a real browser
before calling it done.

It is **self-contained**: it ships its own frontend scaffold, its own backend
drop-in files, and its own verification harness. No reference project has to
be supplied, and nothing has to be written from scratch.

## What it produces

A full back-office: platform analytics, user management with role-based
access, cross-tenant moderation of whatever the app's core records are,
order/payment tracking, catalog and content controls, all behind admin-only
authentication, with every admin mutation written to an audit log.

## Screenshots

From the panel this methodology was extracted from, an events and ticketing
platform.

**Sign-in:** branded, admin-only authentication.

![Login](screenshots/01-login.png)

**Dashboard:** live platform stats (users, events, orders, revenue), a
role breakdown, a 14-day orders/revenue trend, and recent activity feeds.

![Dashboard](screenshots/02-dashboard.png)

**User management:** search and filter every account on the platform,
verify or block users, all role-aware.

![Users](screenshots/03-users.png)

**Event moderation:** every event across every organizer, with status,
pricing, and venue at a glance.

![Events](screenshots/04-events.png)

**Order tracking:** every ticket order platform-wide, searchable by order
number and filterable by payment status.

![Orders](screenshots/05-orders.png)

## The process behind it

Six phases, captured in
[`skill/build-admin-panel/`](skill/build-admin-panel/SKILL.md):

1. **Research the target app:** read the real backend schemas, guards, service
   bodies, and response contracts (not just a route list) before designing
   anything.
2. **Surface scope decisions up front:** what's in scope, how ownership and
   access work, how uploads are handled, all raised as explicit questions
   rather than silent assumptions.
3. **Plan and scaffold:** a phased delivery plan, then
   `scripts/create-panel.sh` emits a complete, typechecking panel in seconds.
4. **Build phase by phase**, one entity at a time, checking types on both
   sides as it goes.
5. **Verify for real:** drive an actual browser through login, every page, and
   a round-tripped write, failing on console errors or failed API calls.
6. **Deploy:** CI/CD reuse, CORS handled explicitly, and the admin account
   seeded and confirmed working against the live URL.

Same process, any stack: hand it a different app and it builds the same way.

## Using the skill

The skill lives in
[`skill/build-admin-panel/`](skill/build-admin-panel/SKILL.md) as an
[Agent Skill](https://docs.claude.com/en/docs/claude-code/skills). To use it
with an agent, copy the `build-admin-panel/` folder into your agent's skills
directory:

- **Claude Code (global):** copy it into `~/.claude/skills/build-admin-panel/`
- **Claude Code (per-project):** copy it into `.claude/skills/build-admin-panel/`

Once installed, the skill activates on its own whenever you ask the agent to
build, add, or scope an admin panel, dashboard, backoffice, or CMS for an
existing app. You can also point it at a codebase first ("research this app so
we can scope an admin panel") to run just the research and scoping phases.

To scaffold a panel directly, without going through the agent:

```bash
skill/build-admin-panel/scripts/create-panel.sh \
  --dest ../acme-admin --name "Acme" --hue 160 \
  --api http://localhost:4000 --install
```

## What's inside

```
skill/build-admin-panel/
├── SKILL.md                          the six-phase method (research to deploy)
├── references/
│   ├── research-and-scope.md         discovery checklist + scoping questions
│   ├── stack-and-conventions.md      the stack, the scaffold, house conventions
│   ├── backend-admin-api.md          admin API: security, queries, stats, mutations
│   ├── frontend-recipes.md           adding an entity: service, page, dialog
│   ├── build-and-verify.md           gotchas, verification, pre-ship checklist
│   ├── other-stacks.md               Django / Rails / Laravel / Express mapping
│   └── deploy.md                     deploying, CORS, seeding a live environment
├── assets/
│   ├── frontend/                     complete Next.js 15 panel template
│   └── backend/nest/                 guards, safe projection, audit log, seed script
└── scripts/
    └── create-panel.sh               scaffold and rebrand a new panel
```

The scaffold ships the parts that are tedious and easy to get subtly wrong: a
single-flight 401-refresh queue, a persisted auth store with the hydration
flag that prevents redirect-flash, a generic data table, a confirm dialog that
collects the reason string the audit log needs, and a Playwright harness that
performs a real write and then reverses it.

The backend files are NestJS and Mongoose, since that is what they were
extracted from. The frontend scaffold is stack-agnostic; see
`references/other-stacks.md` for how the backend patterns map onto Django,
Rails, Laravel, or Express.
