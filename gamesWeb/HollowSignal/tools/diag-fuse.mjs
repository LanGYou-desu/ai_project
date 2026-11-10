import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => { window.__hollow.debugChapter(1); });
await page.waitForFunction(() => window.__hollow.state === 'playing' && window.__hollow.input.enabled, null, { timeout: 120000 });
await page.waitForTimeout(1500);

const info = async (tag) => {
  const data = await page.evaluate(() => {
    const g = window.__hollow;
    const it = (n) => g.level.interactables.find((i) => (i.getLabel?.() || '').includes(n));
    return {
      state: g.state, enabled: g.input.enabled, modal: g.modal, lock: document.pointerLockElement?.id || null,
      player: g.player.position.toArray(), yaw: g.player.yaw, pitch: g.player.pitch,
      cam: g.camera.position.toArray(),
      cur: g.currentInteraction?.getLabel?.(),
      label: document.getElementById('interaction-label').textContent,
      fuseA: it('fuse A') ? { label: it('fuse A').getLabel(), enabled: it('fuse A').enabled, vis: it('fuse A').hitbox.visible, pos: it('fuse A').hitbox.position.toArray() } : null,
      officeOpened: g.level.officeOpened,
      uiInteraction: document.getElementById('interaction').className
    };
  });
  console.log(tag, JSON.stringify(data));
};

// Exactly mirror smoke: cassette + addendum, close both, then teleport fuse A.
await page.evaluate(() => window.__hollow.debugTeleportToItem('cassette'));
await page.waitForTimeout(700);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
console.log('tape modal', await page.evaluate(() => window.__hollow.state));
await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__hollow.state === 'playing');
await page.waitForTimeout(500);
await info('after tape close');

await page.evaluate(() => window.__hollow.debugTeleportToItem('LATTICE addendum'));
await page.waitForTimeout(600);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
console.log('memo modal', await page.evaluate(() => window.__hollow.state));
await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__hollow.state === 'playing');
await page.waitForTimeout(500);
await info('after memo close');

await page.evaluate(() => window.__hollow.debugTeleportToItem('fuse A'));
await page.waitForTimeout(700);
await info('after teleport fuseA 700ms');
await page.waitForTimeout(2000);
await info('after teleport fuseA 2700ms');
await page.screenshot({ path: 'qa-output/diag-fuse.png' });

await page.evaluate(() => window.__hollow.debugTeleportToItem('fuse B'));
await page.waitForTimeout(700);
await info('fuseB 700ms');
await page.evaluate(() => window.__hollow.debugTeleportToItem('fuse A'));
await page.waitForTimeout(700);
await info('fuseA retry 700ms');
await browser.close();
