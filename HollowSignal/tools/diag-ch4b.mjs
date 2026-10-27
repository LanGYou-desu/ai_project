import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() !== 'debug') console.log(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => console.log(`[PAGEERROR] ${e.message}`));
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => { window.__hollow.debugChapter(3); });
await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 120000 });
await page.waitForTimeout(2500);
console.log('initial', await page.evaluate(() => ({ state: window.__hollow.state, enabled: window.__hollow.input.enabled, pos: window.__hollow.player.position.toArray() })));
console.log('teleport', await page.evaluate(() => window.__hollow.debugTeleportToItem('letter in the coat')));
await page.waitForTimeout(1200);
console.log('pre-E', await page.evaluate(() => ({ state: window.__hollow.state, enabled: window.__hollow.input.enabled, pos: window.__hollow.player.position.toArray(), cur: window.__hollow.currentInteraction?.getLabel?.(), label: document.getElementById('interaction-label').textContent, className: document.getElementById('interaction').className })));
await page.keyboard.press('KeyE');
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(250);
  console.log(`t+${(i + 1) * 250}`, await page.evaluate(() => ({ state: window.__hollow.state, modal: window.__hollow.modal, records: window.__hollow.getState().records, noteHidden: document.getElementById('note-modal').classList.contains('is-hidden'), enabled: window.__hollow.input.enabled })));
}
await page.screenshot({ path: 'qa-output/diag-ch4b.png' });
await browser.close();
