import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'debug') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => { window.__hollow.debugChapter(2); });
await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 120000 });
await page.waitForTimeout(1500);

// Put the player in front of the patrol and let it find them.
await page.evaluate(() => {
  const g = window.__hollow;
  g.debugTeleport(0, -5.0, 0, 0);
  g.level.listener.resetTo({ x: 0, z: -9.0 });
});
await page.waitForTimeout(800);
console.log('pre', await page.evaluate(() => ({ state: window.__hollow.state, listener: window.__hollow.level.listener.getDebugInfo() })));
// The Listener is blind: make a loud noise in front of it to start a real chase.
await page.evaluate(() => {
  const g = window.__hollow;
  g.makeNoise({ x: g.player.position.x, y: .2, z: g.player.position.z }, .8);
});
await page.waitForTimeout(500);
console.log('after noise', await page.evaluate(() => ({ state: window.__hollow.state, listener: window.__hollow.level.listener.getDebugInfo() })));
await page.waitForFunction(() => window.__hollow.state === 'dying', null, { timeout: 20000 }).catch(() => {});
console.log('caught state', await page.evaluate(() => ({ state: window.__hollow.state, listener: window.__hollow.level.listener.getDebugInfo(), dist: window.__hollow.level.listener.root.position.distanceTo(window.__hollow.player.position) })));
await page.screenshot({ path: 'qa-output/90-listener-catch.png' });
await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 20000 });
console.log('respawn', await page.evaluate(() => ({ state: window.__hollow.state, pos: window.__hollow.player.position.toArray(), listener: window.__hollow.level.listener.getDebugInfo() })));

// Hide with the Listener adjacent: it must lose the player, not kill them.
await page.evaluate(() => {
  const g = window.__hollow;
  g.debugTeleportToItem('Hide in the locker');
});
await page.waitForTimeout(800);
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
console.log('hidden', await page.evaluate(() => window.__hollow.player.hidden));
await page.evaluate(() => {
  const g = window.__hollow;
  g.level.listener.resetTo({ x: g.player.position.x, z: g.player.position.z - 1.2 });
  g.level.listener.startChase();
});
await page.waitForTimeout(2600);
console.log('while hidden', await page.evaluate(() => ({ state: window.__hollow.state, hidden: window.__hollow.player.hidden, listener: window.__hollow.level.listener.getDebugInfo() })));
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
console.log('after exit', await page.evaluate(() => ({ state: window.__hollow.state, hidden: window.__hollow.player.hidden })));
console.log('logs', logs.join('\n'));
await browser.close();
