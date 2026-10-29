import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({
  executablePath: EDGE, headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  HTMLCanvasElement.prototype.requestPointerLock = function requestPointerLock() { return Promise.resolve(); };
});
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__hollow, null, { timeout: 60000 });
await page.evaluate(() => {
  const g = window.__hollow;
  g.renderPipeline.useAdaptive = false;
});

const spots = [
  [0, 'Ch I tunnel', 0, 18.7, 0, 10.0],
  [1, 'Ch II pump hall', 2.6, 3.8, -5.4, -1.3],
  [2, 'Ch III corridor', 0, 10.5, 0, -5.0],
  [3, 'Ch IV gallery', 0, 1.2, 0, -8.0]
];
const rows = [];
let current = -1;
for (const preset of ['low', 'medium', 'high']) {
  for (const [index, label, x, z, tx, tz] of spots) {
    if (index !== current) {
      await page.evaluate((i) => window.__hollow.debugChapter(i), index);
      await page.waitForFunction(() => window.__hollow.state === 'playing' && window.__hollow.input.enabled, null, { timeout: 120000 });
      current = index;
      await page.waitForTimeout(1200);
    }
    await page.evaluate(({ preset, x, z, tx, tz }) => {
      const g = window.__hollow;
      g.settings.set('quality', preset);
      g.renderPipeline.useAdaptive = false;
      g.renderPipeline.applyQuality();
      g.renderPipeline.dynamicScale = g.settings.quality.renderScale;
      g.renderPipeline._resizeRenderTarget();
      g.debugTeleport(x, z, 0, -.04);
      g.debugLookAt(tx, tz, 1.2);
      document.querySelectorAll('#hud, #pause-button, #interaction, #subtitles, #look-hint, #crosshair').forEach((e) => e.style.display = 'none');
    }, { preset, x, z, tx, tz });
    await page.waitForTimeout(1200);
    const data = await page.evaluate(async () => {
      const g = window.__hollow;
      const times = [];
      let last = performance.now();
      await new Promise((resolve) => {
        const start = last;
        function tick(t) {
          times.push(t - last);
          last = t;
          if (t - start < 2600) requestAnimationFrame(tick);
          else resolve();
        }
        requestAnimationFrame(tick);
      });
      const intervals = times.slice(2);
      const sorted = [...intervals].sort((a, b) => a - b);
      const avg = intervals.reduce((a, b) => a + b, 0) / Math.max(1, intervals.length);
      const p95 = sorted[Math.floor(sorted.length * .95)] || 0;
      const max = sorted[sorted.length - 1] || 0;
      const info = g.renderPipeline.getInfo();
      return {
        frames: intervals.length,
        fps: +(1000 / avg).toFixed(1),
        p95: +p95.toFixed(1),
        max: +max.toFixed(1),
        over25: intervals.filter((v) => v > 25).length,
        over33: intervals.filter((v) => v > 33.4).length,
        calls: info.calls,
        triangles: info.triangles,
        scale: +g.renderPipeline.dynamicScale.toFixed(2)
      };
    });
    rows.push({ preset, ...data, chapter: label });
    console.log(preset.padEnd(6), label.padEnd(16), JSON.stringify(data));
  }
}
console.log('\nSUMMARY');
for (const r of rows) {
  console.log(`${r.preset.padEnd(6)} ${r.chapter.padEnd(16)} ${String(r.fps).padStart(5)} fps  p95 ${String(r.p95).padStart(5)}ms  >25ms ${r.over25}  >33ms ${r.over33}  ${r.calls} calls  ${(r.triangles / 1000).toFixed(0)}k tri  scale ${r.scale}`);
}
await browser.close();
