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

const waitCur = async (needle, timeout = 15000) => {
  try {
    await page.waitForFunction((n) => (window.__hollow.currentInteraction?.getLabel?.() || '').includes(n), needle, { timeout });
    return true;
  } catch { return false; }
};
const info = async (tag) => {
  const data = await page.evaluate(() => {
    const g = window.__hollow;
    return {
      state: g.state, enabled: g.input.enabled, modal: g.modal, lock: document.pointerLockElement?.id || null,
      player: g.player.position.toArray(), yaw: g.player.yaw, pitch: g.player.pitch,
      cam: g.camera.position.toArray(), cur: g.currentInteraction?.getLabel?.(), label: document.getElementById('interaction-label').textContent,
      fuseA: g.level.interactables.find((i) => (i.getLabel?.() || '').includes('fuse A')) ? { label: g.level.interactables.find((i) => (i.getLabel?.() || '').includes('fuse A')).getLabel(), enabled: g.level.interactables.find((i) => (i.getLabel?.() || '').includes('fuse A')).enabled, vis: g.level.interactables.find((i) => (i.getLabel?.() || '').includes('fuse A')).hitbox.visible } : null,
      officeOpened: g.level.officeOpened
    };
  });
  console.log(tag, JSON.stringify(data));
};
const tele = async (needle) => {
  const r = await page.evaluate((n) => window.__hollow.debugTeleportToItem(n), needle);
  const got = await waitCur(needle);
  console.log('tele', needle, r?.label, 'current?', got, 'cur', await page.evaluate(() => window.__hollow.currentInteraction?.getLabel?.()));
  return got;
};
const e = async () => { await page.keyboard.press('KeyE'); await page.waitForTimeout(800); };

await tele('cassette');
await e();
console.log('tape state', await page.evaluate(() => window.__hollow.state));
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await info('after tape close');

await tele('LATTICE addendum');
await e();
console.log('memo state', await page.evaluate(() => window.__hollow.state));
if (await page.evaluate(() => window.__hollow.state === 'modal')) { await page.keyboard.press('Escape'); await page.waitForTimeout(600); }
await info('after memo close');

const gotA = await tele('fuse A');
await page.waitForTimeout(1200);
await info('fuseA after wait');
await page.screenshot({ path: 'qa-output/diag-fuse2.png' });
if (gotA) { await e(); console.log('fuseA state', await page.evaluate(() => ({ state: window.__hollow.state, items: window.__hollow.getState().items, count: window.__hollow.level.fuses.size }))); }
await browser.close();
