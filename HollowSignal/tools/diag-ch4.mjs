import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() !== 'debug') console.log(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => console.log(`[PAGEERROR] ${e.message}`));

await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => { window.__hollow.debugChapter(3); });
await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 120000 });
await page.waitForTimeout(1200);
const info = await page.evaluate(() => {
  const g = window.__hollow;
  return {
    interactables: g.level.interactables.map((it) => ({ label: it.getLabel?.(), enabled: it.enabled, visible: it.hitbox.visible, pos: it.hitbox.position.toArray(), range: it.range })),
    player: g.player.position.toArray(),
    yaw: g.player.yaw, pitch: g.player.pitch,
    camera: g.camera.position.toArray(),
    cameraRot: [g.camera.rotation.x, g.camera.rotation.y, g.camera.rotation.z]
  };
});
console.log(JSON.stringify(info, null, 2));

const result = await page.evaluate(() => {
  const g = window.__hollow;
  const item = g.level.interactables.find((e) => (e.getLabel?.() || '').includes('cassette'));
  const p = item.hitbox.position;
  const t = g.debugTeleportToItem('cassette');
  return { t, after: g.player.position.toArray(), yaw: g.player.yaw, pitch: g.player.pitch, camera: g.camera.position.toArray() };
});
console.log('teleport result', JSON.stringify(result, null, 2));
await page.waitForTimeout(600);
console.log('current interaction', await page.evaluate(() => ({ cur: window.__hollow.currentInteraction?.getLabel?.(), label: document.getElementById('interaction-label').textContent, hidden: document.getElementById('interaction').className })));
await page.keyboard.press('KeyE');
await page.waitForTimeout(900);
console.log('after E', await page.evaluate(() => ({ state: window.__hollow.state, modal: window.__hollow.modal, record: window.__hollow.hasRecord('wren-final') })));
await page.screenshot({ path: 'qa-output/diag-ch4.png' });
await browser.close();
