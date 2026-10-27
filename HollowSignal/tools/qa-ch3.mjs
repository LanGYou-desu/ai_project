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
const pressE = async (wait = 650) => {
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(wait);
};

await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => { window.__hollow.debugChapter(2); });
await waitPlaying(120000);
console.log('START', JSON.stringify(await state()));

let f = await teleport('security keypad');
console.log('keypad found', f?.label, '| label:', await page.locator('#interaction-label').textContent().catch(() => null));
await pressE(500);
console.log('keypad open?', await page.evaluate(() => window.__hollow.ui.keypadState.open), 'state', (await state()).state);
await page.screenshot({ path: path.join(OUT, '60-ch3-keypad.png') });
// Wrong code first: verify rejection, then the correct badge code.
for (const key of ['9', '9', '9', '9', 'Enter']) await page.keyboard.press(key === 'Enter' ? 'Enter' : `Digit${key}`);
await page.waitForTimeout(900);
console.log('after wrong code: open=', await page.evaluate(() => window.__hollow.ui.keypadState.open), 'locked=', await page.evaluate(() => window.__hollow.ui.keypadState.locked));
for (const key of ['0', '3', '1', '7']) await page.keyboard.press(`Digit${key}`);
await page.screenshot({ path: path.join(OUT, '61-ch3-keypad-code.png') });
await page.keyboard.press('Enter');
await page.waitForTimeout(1600);
console.log('after correct code: officeOpened=', await page.evaluate(() => window.__hollow.level.officeOpened), 'doorOpen=', await page.evaluate(() => window.__hollow.level.securityDoor.openState), 'state=', (await state()).state);

// Hiding behaviour.
f = await teleport('Hide in the locker');
console.log('locker found', f?.label);
await pressE(700);
console.log('hidden?', await page.evaluate(() => window.__hollow.player.hidden), 'state', (await state()).state);
await page.screenshot({ path: path.join(OUT, '62-ch3-hiding.png') });
await pressE(500);
console.log('hidden after exit?', await page.evaluate(() => window.__hollow.player.hidden));

// Death + respawn at the checkpoint.
const cpBefore = await page.evaluate(() => ({ ...window.__hollow.checkpoint }));
await page.evaluate(() => window.__hollow.debugKill());
await page.waitForTimeout(500);
console.log('death state', (await state()).state);
await page.screenshot({ path: path.join(OUT, '63-ch3-death.png') });
await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(700);
const cpAfter = await page.evaluate(() => ({ x: window.__hollow.player.position.x, z: window.__hollow.player.position.z }));
console.log('respawned', JSON.stringify(cpAfter), 'checkpoint', JSON.stringify(cpBefore), 'state', (await state()).state);

// Fuse and substation.
f = await teleport('substation fuse');
console.log('fuse found', f?.label, '| label:', await page.locator('#interaction-label').textContent().catch(() => null));
await pressE();
console.log('items after fuse', (await state()).items);
f = await teleport('Install the ceramic fuse');
console.log('substation found', f?.label, '| label:', await page.locator('#interaction-label').textContent().catch(() => null));
await pressE(1800);
console.log('powerOn', await page.evaluate(() => window.__hollow.level.powerOn), 'chaseActive', await page.evaluate(() => window.__hollow.level.chaseActive), 'objective', (await state()).objective);
await page.screenshot({ path: path.join(OUT, '64-ch3-chase.png') });

// Die during the chase, confirm it restarts, then escape.
await page.evaluate(() => window.__hollow.debugKill());
await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2300);
console.log('chase after respawn', await page.evaluate(() => window.__hollow.level.chaseActive), 'state', (await state()).state);
await page.evaluate(() => window.__hollow.debugTeleport(0, 10.2, 0, 0));
await page.waitForTimeout(2600);
console.log('after escape trigger state', (await state()).state, 'chapter', (await state()).chapter);
const intro = await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout: 30000 }).catch(() => null);
console.log('ch4 intro:', !!intro);
if (intro) {
  await page.waitForTimeout(900);
  await page.click('#enter-button', { timeout: 8000 });
  await waitPlaying(30000);
}
console.log('FINAL', JSON.stringify(await state()));
await page.screenshot({ path: path.join(OUT, '65-ch4-start.png') });
console.log('--- logs ---');
console.log(logs.filter(l => !l.includes('sigmaRadians')).slice(0, 40).join('\n'));
await browser.close();
