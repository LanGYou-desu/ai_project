import { chromium } from 'playwright';

const url = 'http://127.0.0.1:5173/?shot=1&cam=2.35,0.62,6.7&look=-0.7,1.6,-15.0&fov=52&time=12';

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__stillwater?.ready), null, { timeout: 120000 });
  await page.waitForTimeout(1500);

  const data = await page.evaluate(`(() => {
    const app = window.__stillwater;
    const post = app.post;
    const cam = app.camera;
    const mul = (m, v) => {
      const x = v[0], y = v[1], z = v[2], w = v[3];
      return [
        m[0] * x + m[4] * y + m[8] * z + m[12] * w,
        m[1] * x + m[5] * y + m[9] * z + m[13] * w,
        m[2] * x + m[6] * y + m[10] * z + m[14] * w,
        m[3] * x + m[7] * y + m[11] * z + m[15] * w,
      ];
    };
    const proj = (m, p) => {
      const c = mul(m, [p[0], p[1], p[2], 1]);
      return [c[0] / c[3], c[1] / c[3], c[2] / c[3], c[3]];
    };
    const camPos = [cam.matrixWorld.elements[12], cam.matrixWorld.elements[13], cam.matrixWorld.elements[14]];
    return {
      camPos,
      camFov: cam.fov,
      reflPos: post.reflectionCamera.position.toArray(),
      reflUp: post.reflectionCamera.up.toArray(),
      reflQuat: post.reflectionCamera.quaternion.toArray(),
      pNdc: proj(post.reflectionVP.elements, [2.0, -0.085, 3.0]),
      qNdc: proj(post.reflectionVP.elements, [2.0, 6.6, -32.0]),
      rNdc: proj(post.reflectionVP.elements, [0, 4, -5]),
      reflSize: [post.reflectionRT.width, post.reflectionRT.height],
    };
  })()`);
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
