import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const mode = process.argv[2] || 'headless';
const browser = await chromium.launch({
  executablePath: EDGE,
  headless: mode !== 'headed',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=d3d11', '--disable-frame-rate-limit']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
const gpu = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown',
    vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'unknown'
  };
});
console.log(mode, 'GPU', gpu);
await page.evaluate(() => { window.__hollow.debugChapter(3); });
await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 120000 });
await page.waitForTimeout(5000);
const sample = await page.evaluate(async () => {
  const g = window.__hollow;
  const fps0 = g.renderPipeline.avgFps;
  const f0 = performance.now();
  const start = g.renderPipeline.renderer.info.render.frame;
  await new Promise((r) => setTimeout(r, 3000));
  const f1 = performance.now();
  return {
    avgFps: fps0,
    nowAvg: g.renderPipeline.avgFps,
    info: g.renderPipeline.getInfo(),
    state: g.state,
    inputEnabled: g.input.enabled,
    calls: g.renderPipeline.renderer.info.render.calls,
    triangles: g.renderPipeline.renderer.info.render.triangles,
    quality: g.settings.qualityName,
    rt: [g.renderPipeline.rt.width, g.renderPipeline.rt.height],
    drawingBuffer: [g.renderPipeline.renderer.domElement.width, g.renderPipeline.renderer.domElement.height]
  };
});
console.log(JSON.stringify(sample, null, 2));
await page.screenshot({ path: `qa-output/perf-${mode}.png` });
await browser.close();
