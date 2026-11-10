import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'debug') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);

console.log('continue hidden:', await page.locator('#continue-button').isHidden(), 'display:', await page.locator('#continue-button').evaluate((el) => getComputedStyle(el).display));
await page.click('[data-action="settings"]');
await page.waitForTimeout(300);
console.log('settings visible:', await page.locator('#settings-screen').isVisible());
const dims = async () => page.evaluate(() => {
  const g = window.__hollow;
  return { name: g.settings.qualityName, scale: g.renderPipeline.dynamicScale, rt: [g.renderPipeline.rt.width, g.renderPipeline.rt.height], msaa: g.renderPipeline.rt.samples, shadow: g.renderPipeline.renderer.shadowMap.enabled, shadowSize: g.level?.player?.flashlight?.shadow?.mapSize?.x };
});
console.log('before', await dims());
await page.click('[data-quality="low"]');
await page.waitForTimeout(400);
console.log('low', await dims());
await page.click('[data-quality="high"]');
await page.waitForTimeout(500);
console.log('high', await dims());
await page.click('[data-quality="medium"]');
await page.waitForTimeout(400);
console.log('medium', await dims());
await page.click('[data-close="settings"]');
await page.waitForTimeout(300);

// New game, enter, jump to chapter 2, reload, then continue.
await page.click('[data-action="new-game"]');
await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout: 120000 });
await page.waitForTimeout(1000);
await page.click('#enter-button');
await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 30000 });
await page.evaluate(() => { window.__hollow.debugChapter(1); });
await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 120000 });
await page.waitForTimeout(1200);
console.log('saved chapter', await page.evaluate(() => localStorage.getItem('hollow-signal.save.v1')));
await page.reload();
await page.waitForFunction(() => window.__hollow);
await page.waitForTimeout(1200);
console.log('continue visible after reload:', await page.locator('#continue-button').isVisible(), 'chapter label:', await page.locator('#continue-chapter').textContent());
await page.screenshot({ path: 'qa-output/80-menu-continue.png' });
await page.click('[data-action="continue"]');
const intro = await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout: 90000 }).catch(() => null);
console.log('continue intro:', !!intro);
if (intro) {
  await page.waitForTimeout(900);
  await page.click('#enter-button');
  await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 30000 });
}
console.log('continued state', JSON.stringify(await page.evaluate(() => window.__hollow.getState())).slice(0, 400));
console.log('--- logs ---');
console.log(logs.join('\n'));
await browser.close();
