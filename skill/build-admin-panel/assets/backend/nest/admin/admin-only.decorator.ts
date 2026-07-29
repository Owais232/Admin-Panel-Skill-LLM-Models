import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

/**
 * Locks a controller (or handler) to authenticated admins.
 *
 * Guard order matters: JwtAuthGuard must run before RolesGuard so that
 * `request.user` exists by the time roles are checked.
 */
export const AdminOnly = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('admin'),
    ApiBearerAuth('bearer'),
    ApiUnauthorizedResponse({ description: 'Login required' }),
    ApiForbiddenResponse({ description: 'Admin access required' }),
  );
