import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../modules/user/user.schema';

export const ROLES_KEY = 'roles';

/**
 * Restricts a handler (or a whole controller) to the given roles.
 *
 * Must be paired with `RolesGuard`, and `JwtAuthGuard` must run FIRST so that
 * `request.user` is populated:
 *
 *   `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')`
 *
 * The import above is type-only, so it is erased at compile time and cannot
 * create a circular runtime dependency with the user module.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
