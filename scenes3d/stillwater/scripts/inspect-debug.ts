import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?shot=1&cam=0.15,1.38,9.8&look=1.05,2.25,-7.2&fov=46&time=8';

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });

  const configs: Array<[string, string]> = [
    ['baseline', ''],
    ['env-off', 'u.uEnvIntensity.value = 0;'],
    ['lights-off', 'u.uLightCount.value = 0;'],
    ['gi-off', 'u.uGIReady.value = 0;'],
    ['env-lights-off', 'u.uEnvIntensity.value = 0; u.uLightCount.value = 0;'],
  ];
  for (const [name, code] of configs) {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean((window as any).__stillwater?.ready), null, { timeout: 120000 });
    await page.waitForTimeout(1200);
    if (code) {
      await page.evaluate(`(() => { const app = window.__stillwater; const u = app.materials.uniforms; ${code} })()`);
      await page.waitForTimeout(700);
    }
    await page.screenshot({ path: `shots/debug-${name}.png` });
    console.log(name);
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
