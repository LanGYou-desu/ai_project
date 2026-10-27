import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'debug') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => { window.__hollow.debugChapter(1); });
await page.waitForFunction(() => window.__hollow.state === 'playing' && window.__hollow.input.enabled, null, { timeout: 120000 });
await page.waitForTimeout(1800);
console.log('start interactables', await page.evaluate(() => window.__hollow.level.interactables.map((i) => i.getLabel?.())));

for (const [needle, id] of [['pump-floor work order', 'pump-log'], ['Wren’s cassette', 'tape-wren-1'], ['LATTICE addendum', 'array-memo']]) {
  const found = await page.evaluate((n) => window.__hollow.debugTeleportToItem(n), needle);
  await page.waitForTimeout(500);
  await page.waitForFunction((n) => (window.__hollow.currentInteraction?.getLabel?.() || '').includes(n), needle, { timeout: 10000 }).catch(() => {});
  console.log('teleport', needle, found?.label, 'cur', await page.evaluate(() => window.__hollow.currentInteraction?.getLabel?.()));
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(600);
  console.log(' ->', id, await page.evaluate((id) => ({ state: window.__hollow.state, modal: window.__hollow.modal, has: window.__hollow.hasRecord(id), records: window.__hollow.getState().records }), id));
  if (needle.includes('cassette')) await page.screenshot({ path: 'qa-output/81-tape-note.png' });
  if (needle.includes('LATTICE')) await page.screenshot({ path: 'qa-output/82-memo-note.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}
// Long note footer check.
await page.evaluate(() => window.__hollow.debugTeleportToItem('personnel badge'));
await page.waitForTimeout(700);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
const geo = await page.evaluate(() => {
  const paper = document.querySelector('#note-modal .paper');
  const body = document.querySelector('#note-modal .note-body');
  const footer = document.querySelector('#note-modal .paper-footer');
  const r = paper.getBoundingClientRect();
  const b = body.getBoundingClientRect();
  const f = footer.getBoundingClientRect();
  return { paper: { top: r.top, bottom: r.bottom, h: r.height }, body: { top: b.top, bottom: b.bottom, h: b.height, scroll: body.scrollHeight }, footer: { top: f.top, bottom: f.bottom, h: f.height }, footerVisible: f.bottom <= r.bottom + 1 };
});
console.log('note geometry', geo);
await page.screenshot({ path: 'qa-output/83-badge-note-layout.png' });
console.log('records total', (await page.evaluate(() => window.__hollow.getState().records)).length);
console.log('logs', logs.join('\n'));
await browser.close();
