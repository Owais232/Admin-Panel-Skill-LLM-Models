# When the backend is not NestJS + Mongo

The bundled backend files are NestJS + Mongoose because that is what they were
extracted from. The **frontend scaffold is stack-agnostic**: it only cares
about the response envelope and the auth endpoints, both of which are already
marked `ADAPT`. Nothing in `assets/frontend/` needs to change because the
backend is Django or Rails.

What follows is how each backend concept translates. The *reasons* behind them
do not change; only the mechanism does.

## Concept map

| Concept | NestJS + Mongoose | Express + Prisma | Django REST Framework | Rails | Laravel |
|---|---|---|---|---|---|
| Role gate | `RolesGuard` + `@Roles()` | middleware on the router | `permission_classes` | `before_action` | route middleware |
| Envelope | response interceptor | wrapper middleware | custom renderer | serializer / `render json:` | API Resource |
| Safe fields | explicit projection | `select` in the query | serializer `fields` | `as_json(only:)` | `$hidden` / Resource |
| Pagination | pagination util | `skip`/`take` | `PageNumberPagination` | Kaminari / Pagy | `paginate()` |
| Atomic counter | `$inc` | `increment` | `F()` expression | `increment!` | `increment()` |
| Seed admin | custom script | custom script | `createsuperuser` | `db/seeds.rb` | seeder class |
| Audit log | Mongo collection | table + middleware | `LogEntry` or custom | `paper_trail` gem | custom / `activitylog` |

## What changes materially

**Safe fields are opt-in vs. opt-out, and this flips the risk.** Mongoose
returns every field unless excluded, so the danger is *forgetting* to exclude
OTPs and reset tokens. DRF serializers and Laravel API Resources are the
opposite: you list what to include, so accidental leakage is far less likely.
Rails `render json: user` without an explicit `only:` behaves like Mongoose,
so the risk is back. Check which model you are in before trusting either
instinct.

**Unknown query parameters fail differently.** NestJS with
`forbidNonWhitelisted: true` returns a 400. DRF, Rails and Express typically
*ignore* an unrecognised parameter. That trades a loud failure for a silent
one: a typo'd filter name returns unfiltered results that look plausible.
Assert the filter actually narrows the result set rather than assuming a wrong
name would have errored.

**Django ships an admin already.** Before building a custom panel on a Django
backend, check whether `django.contrib.admin` covers the need. It genuinely
does for developer-facing CRUD. It is a poor fit when non-technical staff are
the users, when the workflow needs cross-model dashboards and charts, or when
actions must call into service logic rather than edit rows. Say which of those
applies rather than reflexively building a second admin.

**The ORM's lazy loading is the new N+1.** `populate` in Mongoose has direct
analogues that are just as easy to miss: `select_related`/`prefetch_related`,
`includes`, and eager loading in Prisma. An admin list joining an owner onto
every row is the exact shape that turns into one query per row.

**Sessions vs. bearer tokens.** If the backend authenticates with a session
cookie rather than a JWT, the scaffold's refresh-queue machinery is not
needed. Set `withCredentials: true` on the axios instance, delete the refresh
interceptor, and make sure CORS sends `Access-Control-Allow-Credentials` and
a specific origin, since a wildcard origin is rejected with credentials.

## What does not change

Every item in `SKILL.md`'s "five things that go wrong" is stack-independent:

- The envelope still has to be read from the source, not assumed.
- A fresh database still has no admin account. `createsuperuser` is still a
  separate step from deploying.
- Reads still leak secrets unless something explicitly stops them.
- A guard that permits an admin still tells you nothing about whether the
  handler honours a target-user field.
- It still does not work until a real browser says it does.

So does the delivery shape: one admin module, cross-tenant reads reusing the
existing services, mutations shipped in ascending order of risk, an audit log,
and browser verification after each phase.
