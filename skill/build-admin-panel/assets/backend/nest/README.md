# Backend drop-in files (NestJS + Mongoose)

Copy these into the target backend and re-point the import paths. They are
extracted from a working codebase, so the relative imports assume that repo's
layout, not this one. Everything marked `ADAPT` needs a decision; everything
else works as-is.

| File | Goes to | Why it exists |
|---|---|---|
| `common/roles.decorator.ts` | `src/common/decorators/` | `@Roles('admin')` metadata |
| `common/roles.guard.ts` | `src/modules/auth/guards/` | Enforces it. **Guard order is load-bearing** |
| `common/transforms.ts` | `src/common/dto/` | `ToBoolean`, `?flag=false` arrives as the truthy string `'false'` |
| `common/password.util.ts` | `src/common/utils/` | Lets the seed script hash identically without importing AuthService |
| `admin/admin-only.decorator.ts` | `src/modules/admin/decorators/` | `@AdminOnly()` = both guards + Swagger responses |
| `admin/admin.constants.ts` | `src/modules/admin/` | **The safe projection. Read it before shipping a user endpoint.** |
| `admin/admin-list-query.dto.ts` | `src/modules/admin/dto/` | Base list DTO + date-range/sort helpers |
| `admin/admin-audit-log.schema.ts` | `src/modules/admin/schemas/` | Append-only record of admin mutations |
| `admin/admin-audit.service.ts` | `src/modules/admin/services/` | Best-effort writer for the above |
| `admin/seed-admin.ts` | `src/database/` | Creates the first admin. **Nothing is testable without it** |

## Wiring order

1. `roles.decorator.ts` + `roles.guard.ts`, and export `RolesGuard` from
   `AuthModule`.
2. `password.util.ts`, move `getBcryptRounds()` (or equivalent) out of
   `AuthService` verbatim; import it back there so there is one implementation.
3. `seed-admin.ts` + a `"seed:admin"` package script. Run it now; you cannot
   test anything otherwise.
4. `admin.constants.ts`, then the module itself.

## Two failure modes worth knowing before you hit them

**`@UseGuards(JwtAuthGuard, RolesGuard)`, never the reverse.** Nest runs
guards left to right. `RolesGuard` only reads `request.user`; it does not
authenticate. Reversed, it runs before anything populates that, so every admin
request 401s no matter who is calling.

**The admin module must import whatever module provides the guards'
dependencies.** `JwtAuthGuard` is instantiated in the *consuming* module's
injector, not `AuthModule`'s. If it injects a `UserRepository`, then
`AdminModule` needs `imports: [AuthModule, UserModule]` or Nest fails at boot
with a resolution error that names the repository, pointing at the wrong
module entirely. Copy the imports from an existing module that already uses
the same guard.
