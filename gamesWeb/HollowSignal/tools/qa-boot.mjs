import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.resolve('qa-output');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox']
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[PAGEERROR] ${err.stack || err.message}`));
page.on('requestfailed', (req) => logs.push(`[REQFAIL] ${req.url()} :: ${req.failure()?.errorText}`));

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__hollow, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);
console.log('menu visible:', await page.locator('#menu-screen').isVisible());
console.log('boot state:', await page.evaluate(() => window.HOLLOW_SIGNAL?.getState?.() || null));
await page.screenshot({ path: path.join(OUT, '01-menu.png') });

await page.click('[data-action="new-game"]');
await page.waitForTimeout(4000);
console.log('loading visible:', await page.locator('#loading-screen').isVisible());
console.log('loading text:', await page.locator('#loading-status').textContent());
console.log('loading log:', await page.locator('#loading-log').textContent());
await page.screenshot({ path: path.join(OUT, '02-loading.png') });

const intro = await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout: 120000 }).catch(() => null);
console.log('intro shown:', !!intro);
if (intro) {
  console.log('intro lines:', await page.locator('#intro-lines').innerText());
  await page.screenshot({ path: path.join(OUT, '03-intro.png') });
  await page.click('#enter-button');
  await page.waitForTimeout(2000);
}
console.log('state after intro:', await page.evaluate(() => window.__hollow?.getState?.() || null));
console.log('hud visible:', await page.locator('#hud').isVisible());
await page.screenshot({ path: path.join(OUT, '04-chapter1.png') });

const info = await page.evaluate(() => {
  const g = window.__hollow;
  return {
    render: g.renderPipeline.getInfo(),
    settings: g.settings.values,
    levelDebug: g.level?.getDebugInfo?.(),
    interactables: g.level?.interactables?.map((i) => ({ id: i.id, label: i.getLabel?.(), enabled: i.enabled })) || []
  };
});
console.log(JSON.stringify(info, null, 2));
console.log('--- logs ---');
console.log(logs.join('\n'));
await browser.close();
