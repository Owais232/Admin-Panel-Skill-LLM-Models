// ---------------------------------------------------------------------------
// API envelope
//
// ADAPT THIS FIRST. Everything else in the panel depends on it being right,
// and a wrong shape fails SILENTLY (pagination controls simply never appear)
// rather than throwing.
//
// The default below assumes the most common NestJS response-interceptor shape,
// with pagination lifted to a TOP-LEVEL `meta`:
//
//   { success, message, data: [...], meta: {...}, timestamp, path }
//
// If the target backend nests it instead (`{ data: { items, meta } }`) or
// returns a bare array with an `X-Total-Count` header, change `ApiEnvelope`
// and the two unwrap helpers in `lib/api.ts`, those three places are the only
// ones that touch the envelope.
//
// Confirm against the real interceptor source, not one example response.
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
  path: string;
}

// --- Auth ------------------------------------------------------------------

/** ADAPT: match the backend's role enum. */
export type UserRole = 'user' | 'admin';

export interface AuthUser {
  _id?: string;
  email?: string;
  role: UserRole;
}

// --- Example entity --------------------------------------------------------
//
// `AdminUser` is the worked example the users page is built on. Nearly every
// backend has a user collection, but the field names below are a guess,
// replace them with the real schema's fields.
//
// For each additional entity, add its interface here, then clone the
// service/page/dialog trio described in `references/frontend-recipes.md`.

export interface AdminUser {
  _id: string;
  email?: string;
  phone?: string;
  role: UserRole;
  /** Frequently independent of `isBlocked`, check the schema before merging
   *  them into one derived status. */
  isActive?: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  isEmailVerified?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Detail endpoints usually return the record plus related aggregates. */
export interface AdminUserDetail {
  user: AdminUser;
  counts?: Record<string, number>;
}

// --- Dashboard -------------------------------------------------------------
//
// The universal contract implemented by `GET /admin/stats?days=30`. Add
// domain-specific sections alongside `users` as needed; the dashboard page
// renders whatever is present and degrades gracefully when a section is
// missing.

export interface DashboardStats {
  generatedAt?: string;
  range?: { from: string; to: string; days: number };
  users?: {
    total?: number;
    active?: number;
    blocked?: number;
    newInRange?: number;
    byRole?: { role: string; count: number }[];
    newSignupsByDay?: { date: string; count: number }[];
  };
}
