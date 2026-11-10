import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
await page.goto('http://127.0.0.1:4173/');
await page.setContent(`<!doctype html><html><head><style>
@font-face { font-family: 'SE'; src: url('http://127.0.0.1:4173/assets/fonts/SpecialElite-Regular.woff2') format('woff2'); }
body { background: #c3b79e; color: #222; padding: 30px; }
div { font-family: 'SE'; font-size: 22px; line-height: 1.7; margin-bottom: 28px; white-space: pre-wrap; }
.a { font-variant-ligatures: normal; }
.b { font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'calt' 0, 'dlig' 0; }
.c { font-feature-settings: 'kern' 0; }
</style></head><body>
<div class="a">normal: The breaker falls. The array dies. the other thing. TAPE 04 / MARCH 1996. WREN: the walls are answering.</div>
<div class="b">no liga: The breaker falls. The array dies. the other thing. TAPE 04 / MARCH 1996. WREN: the walls are answering.</div>
<div class="c">no kern: The breaker falls. The array dies. the other thing. TAPE 04 / MARCH 1996. WREN: the walls are answering.</div>
</body></html>`);
await page.waitForTimeout(800);
await page.screenshot({ path: 'qa-output/95-font-test.png' });
await page.evaluate(() => { document.querySelector('.a').textContent = 'A: The the TAPE MARCH OTHER there them then'; });
await page.waitForTimeout(200);
await browser.close();
