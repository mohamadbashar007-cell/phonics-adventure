import { chromium } from '@playwright/test';

const baseUrl = process.env.RESPONSIVE_BASE_URL ?? 'http://localhost:3000';

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 },
];

const routes = [
  { name: 'home', path: '/' },
  { name: 'group-map', path: '/group/1' },
  { name: 'lesson-story', path: '/group/1?autostart=1' },
];

const authState = {
  state: {
    username: 'responsive-check',
    userId: null,
    userName: 'Responsive Check',
    age: 8,
    allUnlocked: true,
    isAuthenticated: true,
    profile: null,
    progress: [],
    examScores: [],
  },
  version: 0,
};

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'msedge' });
  } catch {
    return chromium.launch();
  }
}

function makeUrl(path) {
  return new URL(path, baseUrl).toString();
}

const browser = await launchBrowser();
const failures = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });

  await context.addInitScript((value) => {
    window.localStorage.setItem('phonics-progress', JSON.stringify(value));
  }, authState);

  for (const route of routes) {
    const page = await context.newPage();
    const label = `${viewport.name}:${route.name}`;

    try {
      await page.goto(makeUrl(route.path), { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(500);

      const result = await page.evaluate(() => {
        const doc = document.documentElement;
        const viewportWidth = window.innerWidth;
        const overflowX = Math.ceil(doc.scrollWidth - viewportWidth);
        const badElements = [];

        for (const element of Array.from(document.body.querySelectorAll('*'))) {
          const style = window.getComputedStyle(element);
          if (style.position === 'fixed' || style.visibility === 'hidden' || style.display === 'none') continue;

          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          if (rect.right > viewportWidth + 2 || rect.left < -2) {
            badElements.push({
              tag: element.tagName.toLowerCase(),
              className: String(element.className || '').slice(0, 120),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            });
          }
        }

        return {
          url: window.location.href,
          viewportWidth,
          scrollWidth: doc.scrollWidth,
          overflowX,
          badElements: badElements.slice(0, 10),
        };
      });

      if (result.overflowX > 2 || result.badElements.length > 0) {
        failures.push({ label, ...result });
      }

      console.log(`${label}: scrollWidth=${result.scrollWidth}, viewport=${result.viewportWidth}, overflow=${result.overflowX}`);
    } finally {
      await page.close();
    }
  }

  await context.close();
}

await browser.close();

if (failures.length > 0) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
