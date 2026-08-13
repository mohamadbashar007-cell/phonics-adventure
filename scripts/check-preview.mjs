import { chromium } from '@playwright/test';

const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const body = await page.locator('body').innerText();
  const loginVisible = /sign in|log in|password|email address/i.test(body);
  const groupButtons = page.locator('button').filter({ hasText: /Group\s+\d+/ });
  const groupCount = await groupButtons.count();
  const disabledGroups = await groupButtons.evaluateAll((nodes) =>
    nodes.filter((node) => node.disabled).length
  );

  await page.getByRole('button', { name: /Start Adventure/i }).click();
  await groupButtons.nth(1).click();
  await page.waitForLoadState('networkidle');

  const result = {
    loginVisible,
    groupCount,
    disabledGroups,
    route: new URL(page.url()).hash,
    lockedLessons: await page.locator('button[aria-label^="Locked lesson"]').count(),
    openLessons: await page.locator('button[aria-label^="Start lesson"]').count(),
    pageErrors,
  };

  console.log(JSON.stringify(result, null, 2));

  if (
    result.loginVisible ||
    result.groupCount === 0 ||
    result.disabledGroups > 0 ||
    result.lockedLessons > 0 ||
    result.openLessons === 0 ||
    result.route !== '#/group/2' ||
    result.pageErrors.length > 0
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
