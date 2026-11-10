import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => { window.__hollow.debugChapter(2); });
await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 120000 });
await page.waitForTimeout(1200);
// Unlock the office and take the fuse without the keypad, so this test focuses on the chase.
await page.evaluate(() => {
  const g = window.__hollow;
  g.giveItem('fuse', 'CERAMIC FUSE');
  g.debugTeleport(0, -19.9, Math.PI, 0);
});
await page.waitForTimeout(400);
await page.evaluate(() => window.__hollow.level._useSubstation());
await page.waitForTimeout(1200);
console.log('chase start', await page.evaluate(() => ({ state: window.__hollow.state, pos: window.__hollow.player.position.toArray(), listener: window.__hollow.level.listener.getDebugInfo() })));
await page.screenshot({ path: 'qa-output/91-chase-start.png' });
// Run south toward the lift.
await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyW');
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1000);
  const s = await page.evaluate(() => ({ state: window.__hollow.state, pos: [+window.__hollow.player.position.x.toFixed(1), +window.__hollow.player.position.z.toFixed(1)], stamina: +window.__hollow.player.stamina.toFixed(2), listener: window.__hollow.level.listener.getDebugInfo(), chapter: window.__hollow.chapterIndex }));
  console.log(i + 1, JSON.stringify(s));
  if (s.state !== 'playing') break;
}
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
await page.screenshot({ path: 'qa-output/92-chase-end.png' });
await browser.close();
