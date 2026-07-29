/**
 * Fields that must never reach the admin panel.
 *
 * READ THIS BEFORE SHIPPING ANY USER ENDPOINT.
 *
 * Schemas typically mark only `password` as `select: false`. Every OTP,
 * password-reset token, email-verification token and account-deletion token is
 * therefore returned BY DEFAULT. Without an explicit exclusion projection the
 * panel renders live, still-valid credentials into the browser's network tab,
 * an account-takeover path for anyone with access to an admin machine, a
 * screen recording, or a browser extension.
 *
 * Nobody notices, because the UI never displays these fields. The only way to
 * catch it is to read the raw JSON of a real response.
 *
 * ADAPT: open the user schema and list every token/OTP/secret field here.
 *
 * Exclusion-only, Mongo forbids mixing inclusion and exclusion in one
 * projection, so never add `field: 1` entries.
 */
export const ADMIN_USER_SAFE_PROJECTION = {
  password: 0,
  emailVerificationToken: 0,
  emailVerificationExpires: 0,
  resetPasswordToken: 0,
  resetPasswordExpires: 0,
  createPasswordToken: 0,
  createPasswordExpires: 0,
  deleteAccountOtp: 0,
  deleteAccountOtpExpires: 0,
  deleteAccountToken: 0,
  deleteAccountTokenExpires: 0,
  twoFactorSecret: 0,
} as const;

/**
 * Compact user shape for populating an owner onto another document.
 *
 * A `.populate('user')` with no select returns the WHOLE user document,
 * including everything the projection above exists to strip. Every populate of
 * a user reference needs this.
 */
export const ADMIN_USER_SUMMARY_SELECT = 'email phone role isBlocked isActive';

/**
 * Upper bound on any pre-resolution step that feeds an `$in` (e.g. resolving
 * a name search against a Profile collection before querying users). Stops a
 * one-character search from building an unbounded id array.
 */
export const RELATED_MATCH_CAP = 2000;
