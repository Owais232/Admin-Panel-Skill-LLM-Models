import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { UserRole } from '../../user/user.schema';
import type { AuthenticatedRequest } from '../auth.types';

/**
 * Enforces `@Roles(...)`. Does NOT authenticate, it only reads
 * `request.user`, which `JwtAuthGuard` is responsible for setting.
 *
 * Guard order is load-bearing: `@UseGuards(JwtAuthGuard, RolesGuard)`.
 * Nest runs guards left to right, so reversing them yields a permanent 401.
 *
 * Exception messages intentionally match the inline checks this guard
 * replaces, so existing clients see no behavioural change.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Handler-level roles override controller-level roles.
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.userId) {
      throw new UnauthorizedException('Login required');
    }

    if (!requiredRoles.includes(user.role as UserRole)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
