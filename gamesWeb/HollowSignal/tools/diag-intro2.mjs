import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'debug') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));

await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
console.log('boot', await page.evaluate(() => window.__hollow.state));
await page.evaluate(() => { window.__hollow.debugChapter(1, { intro: true }); });
await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout: 180000 });
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const btn = document.getElementById('enter-button');
  const inner = document.querySelector('.intro-inner');
  const overlay = document.getElementById('intro-overlay');
  const r = btn.getBoundingClientRect();
  const ri = inner.getBoundingClientRect();
  const cs = getComputedStyle(btn);
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const stack = document.elementsFromPoint(cx, cy).map((el) => `${el.tagName}#${el.id}.${el.className}`);
  return {
    state: window.__hollow.state,
    btnRect: { x: r.x, y: r.y, w: r.width, h: r.height },
    innerRect: { x: ri.x, y: ri.y, w: ri.width, h: ri.height },
    btnStyle: { display: cs.display, visibility: cs.visibility, opacity: cs.opacity, pointerEvents: cs.pointerEvents, transform: cs.transform, filter: cs.filter, animation: cs.animationName, zIndex: cs.zIndex },
    stack,
    innerHTML: inner.innerHTML.slice(0, 400),
    innerRect2: inner.getClientRects()[0] ? { x: inner.getClientRects()[0].x, y: inner.getClientRects()[0].y, w: inner.getClientRects()[0].width, h: inner.getClientRects()[0].height } : null,
    point: { cx, cy },
    scrollY: window.scrollY,
    pointerLockElement: document.pointerLockElement?.id || null
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'qa-output/diag-intro2.png' });
try {
  await page.click('#enter-button', { timeout: 5000 });
  console.log('CLICK OK');
} catch (e) {
  console.log('CLICK FAIL:', e.message.split('\n').slice(0, 8).join('\n'));
  await page.evaluate(() => document.getElementById('enter-button').click());
  console.log('programmatic click dispatched');
}
await page.waitForTimeout(1500);
console.log('state after', await page.evaluate(() => window.__hollow.state));
await browser.close();
