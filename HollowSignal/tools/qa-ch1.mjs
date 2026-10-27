import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.resolve('qa-output');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'debug') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));

const state = () => page.evaluate(() => window.__hollow.getState());
const waitPlaying = async (timeout = 30000) => {
  await page.waitForFunction(() => window.__hollow?.state === 'playing', null, { timeout }).catch(() => {});
  await page.evaluate(() => { window.__hollow?.ui?.hideClickResume?.(); });
};

await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.click('[data-action="new-game"]');
await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout: 180000 });
console.log('chapter 1 intro shown');
await page.waitForTimeout(1000);
await page.click('#enter-button');
await waitPlaying(30000);
console.log('PLAYING CH1', JSON.stringify(await state()));

const goItem = async (label) => {
  const found = await page.evaluate((needle) => window.__hollow.debugTeleportToItem(needle), label);
  await page.waitForTimeout(300);
  return found;
};

let found = await goItem('service access card');
console.log('go card', found);
console.log('interaction label:', await page.locator('#interaction-label').textContent().catch(() => null));
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
console.log('after E state', JSON.stringify(await state()));
await page.screenshot({ path: path.join(OUT, '40-ch1-card.png') });

if (!(await state()).items.keycard) {
  console.log('fallback use nearest for card', await page.evaluate(() => window.__hollow.debugUseNearest()));
  await page.waitForTimeout(300);
  console.log('after fallback', JSON.stringify(await state()));
}

found = await goItem('card reader');
console.log('go reader', found);
console.log('reader label:', await page.locator('#interaction-label').textContent().catch(() => null));
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
console.log('after reader', JSON.stringify(await state()));
console.log('door open?', await page.evaluate(() => window.__hollow.level?.securityDoor?.openState));
await page.screenshot({ path: path.join(OUT, '41-ch1-reader.png') });

found = await goItem('service lift');
console.log('go lift', found);
console.log('lift label:', await page.locator('#interaction-label').textContent().catch(() => null));
await page.keyboard.press('KeyE');
await page.waitForTimeout(1500);
console.log('after lift state', JSON.stringify(await state()));
const intro2 = await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout: 30000 }).catch(() => null);
console.log('chapter 2 intro shown:', !!intro2);
if (intro2) {
  console.log('intro title/body', await page.locator('#intro-kicker').textContent(), await page.locator('#intro-lines').innerText());
  await page.click('#enter-button');
  await waitPlaying(20000);
}
console.log('FINAL', JSON.stringify(await state()));
await page.screenshot({ path: path.join(OUT, '42-ch2-start.png') });
console.log('--- logs ---');
console.log(logs.filter(l => !l.includes('sigmaRadians')).slice(0, 60).join('\n'));
await browser.close();
