import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => { window.__hollow.debugChapter(3); });
await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 120000 });
await page.waitForTimeout(1200);
await page.evaluate(() => window.__hollow.debugChoice('purge'));
await page.waitForTimeout(4000);
const dom = await page.evaluate(() => {
  const body = document.getElementById('ending-body');
  return {
    innerHTML: body.innerHTML,
    innerText: body.innerText,
    textContent: body.textContent,
    font: getComputedStyle(body.querySelector('p')).fontFamily,
    size: getComputedStyle(body.querySelector('p')).fontSize,
    fonts: [...document.fonts].map((f) => ({ family: f.family, status: f.status, weight: f.weight, style: f.style })),
    check: document.fonts.check('12px "Special Elite"')
  };
});
console.log(JSON.stringify(dom, null, 2));
await page.screenshot({ path: 'qa-output/96-ending-dom.png' });
// Isolate one paragraph in a fresh overlay at 12px using the exact same class.
await page.evaluate(() => {
  const clone = document.createElement('div');
  clone.id = 'isolate';
  clone.style.cssText = 'position:absolute;z-index:200;left:40px;top:40px;padding:20px;background:#c3b79e;color:#222;width:900px';
  clone.innerHTML = '<p style="font-family:\'Special Elite\';font-size:16px">The breaker falls. The array dies. the other thing.</p><p style="font-family:\'Special Elite\';font-size:12px">The breaker falls. The array dies. the other thing.</p>';
  document.body.appendChild(clone);
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'qa-output/97-ending-isolate.png' });
await browser.close();
