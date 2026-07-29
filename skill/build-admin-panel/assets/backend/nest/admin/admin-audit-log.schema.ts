import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AdminAuditLogDocument = HydratedDocument<AdminAuditLog>;

/** ADAPT: one entry per admin mutation the panel can perform. */
export const ADMIN_AUDIT_ACTIONS = [
  'user.block',
  'user.unblock',
  'user.verify',
  'user.credits',
  'record.status-override',
  'catalog.create',
  'catalog.update',
  'catalog.delete',
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

/** ADAPT: the collections an admin action can target. */
export const ADMIN_AUDIT_TARGETS = ['User', 'Record', 'CatalogItem'] as const;
export type AdminAuditTarget = (typeof ADMIN_AUDIT_TARGETS)[number];

/**
 * Append-only record of every admin mutation.
 *
 * This is what makes otherwise-invisible admin action traceable after the
 * fact. It earns its keep the first time someone asks "who zeroed this
 * account's balance?" or "why did this record's status change overnight?",
 * without it the answer is unknowable, because the mutation leaves no trace
 * beyond the new value itself.
 *
 * Store `before` AND `after`. A log holding only the new value cannot
 * distinguish a real change from a no-op retry.
 */
@Schema({ timestamps: true })
export class AdminAuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  actor: Types.ObjectId;

  /** Denormalised so the log stays readable after an account is deleted. */
  @Prop({ type: String })
  actorEmail?: string;

  @Prop({ enum: ADMIN_AUDIT_ACTIONS, required: true, index: true })
  action: AdminAuditAction;

  @Prop({ enum: ADMIN_AUDIT_TARGETS, required: true })
  targetModel: AdminAuditTarget;

  @Prop({ type: Types.ObjectId, required: true })
  targetId: Types.ObjectId;

  @Prop({ type: Object })
  before?: Record<string, unknown>;

  @Prop({ type: Object })
  after?: Record<string, unknown>;

  @Prop({ type: String })
  reason?: string;
}

export const AdminAuditLogSchema = SchemaFactory.createForClass(AdminAuditLog);

AdminAuditLogSchema.index({ createdAt: -1 });
AdminAuditLogSchema.index({ targetModel: 1, targetId: 1, createdAt: -1 });
