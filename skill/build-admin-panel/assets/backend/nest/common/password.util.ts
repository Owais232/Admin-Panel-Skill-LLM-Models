const DEFAULT_BCRYPT_ROUNDS = 10;

/**
 * Bcrypt cost factor from `BCRYPT_ROUNDS`, clamped to a sane 8..15 range.
 *
 * Extracted verbatim from `auth.service.ts` so standalone scripts (notably
 * `src/database/seed-admin.ts`) can hash passwords identically without
 * importing AuthService, which would pull in the entire DI graph
 * (google-auth-library, apple-signin-auth, the email queue, ...).
 */
export function getBcryptRounds() {
  const rawValue = process.env.BCRYPT_ROUNDS;
  const parsedValue = rawValue ? Number(rawValue) : NaN;

  return Number.isInteger(parsedValue) && parsedValue >= 8 && parsedValue <= 15
    ? parsedValue
    : DEFAULT_BCRYPT_ROUNDS;
}
