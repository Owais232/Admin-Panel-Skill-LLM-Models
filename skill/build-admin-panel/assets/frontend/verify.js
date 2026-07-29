/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * End-to-end smoke test for the admin panel.
 *
 * A clean typecheck and a clean build prove nothing about whether the panel
 * actually works: a page can return HTTP 200 while every JS chunk 404s and the
 * app never hydrates. Only a real browser catches that.
 *
 *   node verify.js
 *
 * Env:
 *   PANEL_URL            default http://localhost:3001
 *   ADMIN_EMAIL          required, the seeded admin
 *   ADMIN_PASSWORD       required
 *   VERIFY_WRITE_EMAIL   optional, a NON-ADMIN account to round-trip a real
 *                        write against (block, then unblock to restore).
 *                        Skipped when unset, and the run then only proves
 *                        reads.
 *
 * Exit code is 0 only when there are no console errors and no failed API
 * calls. Failed *asset* requests are reported but not fatal, see BENIGN.
 */
const { chromium } = require('playwright');

const BASE = process.env.PANEL_URL ?? 'http://localhost:3001';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const WRITE_EMAIL = process.env.VERIFY_WRITE_EMAIL;

if (!EMAIL || !PASSWORD) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
  process.exit(2);
}

// ADAPT: one entry per sidebar page, [path, expected <h1> text].
const PAGES = [
  ['/dashboard', 'Dashboard'],
  ['/dashboard/users', 'Users'],
];

/**
 * Not every failed request is a defect.
 *  - `?_rsc=` requests are Next.js RSC prefetches the router aborts on
 *    navigation. Aborting them is the router working correctly.
 *  - Seeded demo records often point at object-storage URLs that were never
 *    uploaded; those 404s are bad test data, not a broken panel.
 * Anything hitting the API is never benign.
 */
const BENIGN = [/[?&]_rsc=/];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const apiFailures = [];
  const assetFailures = [];

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('requestfailed', (r) => {
    const line = `FAILED ${r.url()} ${r.failure()?.errorText ?? ''}`;
    if (BENIGN.some((re) => re.test(r.url()))) return;
    (r.url().includes('/api/') ? apiFailures : assetFailures).push(line);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) {
      apiFailures.push(`${r.status()} ${r.url()}`);
    }
  });

  // --- login ---
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#identifier', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  console.log('login: OK ->', page.url());

  // --- sweep every sidebar page ---
  for (const [path, heading] of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(`h1:has-text("${heading}")`, { timeout: 20000 });
    await page.waitForTimeout(1200);
    // A persistent "Loading…" is the signature of a dead auth guard OR of a
    // corrupted dev-server cache. Both look identical from the outside.
    const stuck = await page.locator('text=Loading…').count();
    console.log(`page ${path}: heading OK${stuck ? '  ** STUCK LOADING **' : ''}`);
  }

  // --- rows actually render (an empty table passes a heading check) ---
  await page.goto(`${BASE}/dashboard/users`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const rows = await page.locator('tbody tr').count();
  console.log('users rows rendered:', rows);

  // --- detail dialog populates ---
  if (rows > 0) {
    await page.locator('tbody tr').first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
    await page.waitForTimeout(1000);
    console.log('detail dialog opened: OK');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // --- search filters the list (proves the query round-trips) ---
  await page.fill('input[placeholder*="Search"]', 'zzz-no-match-zzz');
  await page.waitForTimeout(1500);
  const emptyText = await page.locator('tbody').innerText();
  console.log('search empty-state works:', /No users found/i.test(emptyText));

  // --- ONE REAL WRITE, round-tripped back to the original state ---
  // Exercises the full stack: dialog -> mutation hook -> PATCH -> RolesGuard
  // -> DB -> cache invalidation -> re-render.
  if (WRITE_EMAIL) {
    await page.fill('input[placeholder*="Search"]', WRITE_EMAIL);
    await page.waitForTimeout(1500);
    await page.locator('tbody tr').first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
    await page.waitForTimeout(800);

    const before = await page.locator('[data-testid="toggle-block"]').innerText();
    await page.locator('[data-testid="toggle-block"]').click();
    await page.waitForTimeout(500);
    // The reason field is required by the confirm dialog on destructive acts.
    const reason = page.locator('#confirm-reason');
    if (await reason.count()) await reason.fill('automated verification');
    // The confirm is a second dialog stacked over the detail one.
    await page
      .locator('[role="dialog"] button:has-text("Block"), [role="dialog"] button:has-text("Unblock")')
      .last()
      .click();
    await page.waitForTimeout(2500);

    const after = await page.locator('[data-testid="toggle-block"]').innerText();
    console.log(`WRITE: "${before}" -> "${after}" (changed: ${before !== after})`);

    // Restore, so running this twice is a no-op on the data.
    if (before !== after) {
      await page.locator('[data-testid="toggle-block"]').click();
      await page.waitForTimeout(500);
      const reason2 = page.locator('#confirm-reason');
      if (await reason2.count()) await reason2.fill('automated verification');
      await page
        .locator('[role="dialog"] button:has-text("Block"), [role="dialog"] button:has-text("Unblock")')
        .last()
        .click();
      await page.waitForTimeout(2500);
      const restored = await page.locator('[data-testid="toggle-block"]').innerText();
      console.log('WRITE restored:', restored === before);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } else {
    console.log('WRITE: skipped (set VERIFY_WRITE_EMAIL to exercise a mutation)');
  }

  // --- visual evidence ---
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'dashboard.png', fullPage: true });

  // --- logout ---
  await page.click('button[aria-label="Log out"]');
  await page.waitForURL('**/login', { timeout: 20000 });
  console.log('logout: OK ->', page.url());

  console.log('\nconsole errors:', consoleErrors.length);
  consoleErrors.slice(0, 8).forEach((e) => console.log('  ', e.slice(0, 160)));
  console.log('API failures:', apiFailures.length);
  apiFailures.slice(0, 8).forEach((e) => console.log('  ', e.slice(0, 160)));
  console.log('asset failures (non-fatal):', assetFailures.length);
  assetFailures.slice(0, 5).forEach((e) => console.log('  ', e.slice(0, 160)));

  await browser.close();
  process.exit(consoleErrors.length || apiFailures.length ? 1 : 0);
})();
