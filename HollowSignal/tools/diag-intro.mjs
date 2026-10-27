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
await page.click('[data-action="new-game"]');
await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout: 180000 });
await page.waitForTimeout(4000);

const info = await page.evaluate(() => {
  const btn = document.getElementById('enter-button');
  const inner = document.querySelector('.intro-inner');
  const overlay = document.getElementById('intro-overlay');
  const r = btn.getBoundingClientRect();
  const ri = inner.getBoundingClientRect();
  const cs = getComputedStyle(btn);
  const csInner = getComputedStyle(inner);
  const csOverlay = getComputedStyle(overlay);
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const stack = document.elementsFromPoint(cx, cy).map((el) => `${el.tagName}#${el.id}.${el.className}`);
  return {
    btnRect: { x: r.x, y: r.y, w: r.width, h: r.height },
    innerRect: { x: ri.x, y: ri.y, w: ri.width, h: ri.height },
    btnStyle: { display: cs.display, visibility: cs.visibility, opacity: cs.opacity, pointerEvents: cs.pointerEvents, transform: cs.transform, animation: cs.animation, zIndex: cs.zIndex, position: cs.position },
    innerStyle: { display: csInner.display, visibility: csInner.visibility, opacity: csInner.opacity, pointerEvents: csInner.pointerEvents, transform: csInner.transform, zIndex: csInner.zIndex, position: csInner.position },
    overlayStyle: { display: csOverlay.display, opacity: csOverlay.opacity, pointerEvents: csOverlay.pointerEvents, zIndex: csOverlay.zIndex },
    stack,
    innerText: inner.innerText,
    scrollY: window.scrollY,
    docOverflow: getComputedStyle(document.documentElement).overflow,
    bodyOverflow: getComputedStyle(document.body).overflow,
    dpr: window.devicePixelRatio,
    scrollH: document.documentElement.scrollHeight,
    clientH: document.documentElement.clientHeight
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'qa-output/diag-intro.png' });

try {
  await page.click('#enter-button', { timeout: 5000 });
  console.log('CLICK OK');
} catch (e) {
  console.log('CLICK FAIL:', e.message.split('\n').slice(0, 12).join('\n'));
}
await page.waitForTimeout(1000);
console.log('state after', await page.evaluate(() => window.__hollow.state));
console.log('logs', logs.filter(l => !l.includes('sigmaRadians')).slice(0, 30).join('\n'));
await browser.close();
