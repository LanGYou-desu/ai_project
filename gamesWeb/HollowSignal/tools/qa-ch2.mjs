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
  await page.waitForFunction(() => window.__hollow?.state === 'playing', null, { timeout });
  await page.evaluate(() => { window.__hollow?.ui?.hideClickResume?.(); });
};
const teleport = async (label) => {
  const found = await page.evaluate((needle) => window.__hollow.debugTeleportToItem(needle), label);
  await page.waitForTimeout(250);
  if (!found) console.log('  !! item not found:', label);
  return found;
};
const pressE = async () => {
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(650);
};
const closeModal = async () => {
  const s = await state();
  if (s.state === 'modal') {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
};

await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => { window.__hollow.debugChapter(1); });
await waitPlaying(120000);
console.log('START', JSON.stringify(await state()));

for (const fuse of ['fuse A', 'fuse B', 'fuse C']) {
  const found = await teleport(fuse);
  console.log('teleport', fuse, found?.label, '| label:', await page.locator('#interaction-label').textContent().catch(() => null));
  await pressE();
  const s = await state();
  console.log('  after', fuse, 'items=', s.items, 'obj=', s.objective);
}
console.log('fuses collected', await page.evaluate(() => window.__hollow.level.fuses.size));

let f = await teleport('main breaker');
console.log('breaker found', f?.label, '| sub:', await page.locator('#interaction-sub').textContent().catch(() => null));
await pressE();
let s = await state();
console.log('breaker result', { powerOn: await page.evaluate(() => window.__hollow.level.powerOn), objective: s.objective, bakeMs: s.level.bakeMs, bakedLights: s.level.bakedLights });
await page.waitForTimeout(2200);
console.log('silhouette', await page.evaluate(() => ({ shown: window.__hollow.level.silhouetteShown, visible: window.__hollow.level.listener?.root?.visible, active: window.__hollow.level.listener?.active })));
await page.screenshot({ path: path.join(OUT, '50-ch2-power.png') });

f = await teleport('personnel badge');
console.log('badge found', f?.label, '| label:', await page.locator('#interaction-label').textContent().catch(() => null));
await pressE();
s = await state();
console.log('badge state', s.state, 'modal', await page.evaluate(() => window.__hollow.modal), 'hasRecord', await page.evaluate(() => window.__hollow.hasRecord('badge-wren')));
await page.screenshot({ path: path.join(OUT, '51-ch2-badge-note.png') });
await closeModal();
console.log('after close', (await state()).state);

f = await teleport('freight lift');
console.log('lift found', f?.label, '| label:', await page.locator('#interaction-label').textContent().catch(() => null), '| sub:', await page.locator('#interaction-sub').textContent().catch(() => null));
await pressE();
console.log('after lift', (await state()).state);
const intro = await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout: 30000 }).catch(() => null);
console.log('ch3 intro:', !!intro);
if (intro) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '52-ch3-intro.png') });
  await page.click('#enter-button', { timeout: 8000 });
  await waitPlaying(20000);
}
console.log('FINAL', JSON.stringify(await state()));
await page.screenshot({ path: path.join(OUT, '53-ch3-start.png') });
console.log('--- logs ---');
console.log(logs.filter(l => !l.includes('sigmaRadians')).slice(0, 40).join('\n'));
await browser.close();
