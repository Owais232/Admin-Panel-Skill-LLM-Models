/**
 * Every product-specific string in the panel lives here.
 *
 * Rebranding a scaffolded panel is exactly two edits:
 *   1. this file
 *   2. the `--primary` / `--ring` hues in `src/app/globals.css`
 *
 * `scripts/create-panel.sh` writes both for you; edit by hand afterwards to
 * refine the copy.
 */
export const BRAND = {
  /** Sidebar wordmark and browser title, e.g. "Flitez Admin". */
  name: 'Admin Panel',
  /** `<meta name="description">`. */
  description: 'Administration panel',
  /** Headline on the left half of the login screen. */
  tagline: 'Everything under one roof.',
  /** Placeholder in the login identifier field. */
  loginPlaceholder: 'admin@example.com',
  /** Three short value props listed under the login headline. */
  highlights: [
    'Manage every account on the platform',
    'Review and moderate operational records',
    'Track revenue and subscriptions',
  ],
} as const;
