import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AdminAuditAction,
  AdminAuditLog,
  AdminAuditLogDocument,
  AdminAuditTarget,
} from '../schemas/admin-audit-log.schema';

export interface AuditInput {
  actorId: string;
  actorEmail?: string;
  action: AdminAuditAction;
  targetModel: AdminAuditTarget;
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(
    @InjectModel(AdminAuditLog.name)
    private readonly auditModel: Model<AdminAuditLogDocument>,
  ) {}

  /**
   * Deliberately best-effort: an audit-write failure must never fail the
   * mutation the admin actually asked for. Errors are logged, not thrown.
   */
  record(input: AuditInput): void {
    void this.auditModel
      .create({
        actor: new Types.ObjectId(input.actorId),
        actorEmail: input.actorEmail,
        action: input.action,
        targetModel: input.targetModel,
        targetId: new Types.ObjectId(input.targetId),
        before: input.before,
        after: input.after,
        reason: input.reason,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to write audit log for ${input.action} on ${input.targetId}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
  }
}
