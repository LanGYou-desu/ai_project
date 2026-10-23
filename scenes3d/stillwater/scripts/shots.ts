import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = 5173;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = 'shots';

interface View {
  name: string;
  cam: string;
  look: string;
  fov: number;
  time: number;
}

const VIEWS: View[] = [
  { name: 'hero', cam: '0.15,1.38,9.8', look: '1.05,2.25,-7.2', fov: 46, time: 8.0 },
  { name: 'low', cam: '2.35,0.62,6.7', look: '-0.7,1.6,-15.0', fov: 52, time: 12.0 },
  { name: 'arcade', cam: '-7.3,2.05,-1.8', look: '2.3,3.25,-13.5', fov: 52, time: 5.5 },
  { name: 'far', cam: '0.2,2.1,-19.0', look: '0.2,4.0,-32.0', fov: 48, time: 16.0 },
  { name: 'back', cam: '0.6,3.3,-24.5', look: '0.0,2.2,18.0', fov: 50, time: 20.0 },
  { name: 'entrance', cam: '0.4,3.35,2.2', look: '0.0,4.35,14.35', fov: 48, time: 22.0 },
  { name: 'rings', cam: '-2.4,1.34,-1.6', look: '1.15,1.9,-5.5', fov: 42, time: 18.0 },
];

async function waitForServer(url: string, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server still warming up.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Vite server did not start');
}

async function main() {
  const outArg = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1];
  const output = outArg || OUT;
  const dprRaw = Number(process.argv.find((a) => a.startsWith('--dpr='))?.split('=')[1] ?? 1);
  const dpr = Number.isFinite(dprRaw) && dprRaw > 0 ? Math.min(dprRaw, 3) : 1;
  await mkdir(output, { recursive: true });
  let server: ChildProcess | null = null;
  let alreadyRunning = false;
  try {
    const res = await fetch(BASE);
    alreadyRunning = res.ok;
  } catch {
    alreadyRunning = false;
  }

  if (!alreadyRunning) {
    server = spawn('npx.cmd', ['vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    server.stdout?.on('data', (d: Buffer) => process.stdout.write(`[vite] ${d.toString()}`));
    server.stderr?.on('data', (d: Buffer) => process.stderr.write(`[vite] ${d.toString()}`));
    await waitForServer(BASE);
  }

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: [
      '--use-angle=d3d11',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--enable-unsafe-webgpu',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: dpr,
  });
  const messages: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      messages.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => messages.push(`pageerror: ${err.stack ?? err.message}`));

  const requested = process.argv.slice(2).filter((a) => !a.startsWith('-') && !a.startsWith('--'));
  const views = requested.length ? VIEWS.filter((v) => requested.includes(v.name)) : VIEWS;
  const debugArg = process.argv.find((a) => a.startsWith('--debug='))?.split('=')[1] ?? '';

  for (const view of views) {
    const url = `${BASE}/?shot=1&cam=${view.cam}&look=${view.look}&fov=${view.fov}&time=${view.time}${debugArg ? `&debug=${debugArg}` : ''}`;
    console.log(`\nCapturing ${view.name} — ${url}`);
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean((window as unknown as { __stillwater?: { ready?: boolean } }).__stillwater?.ready), null, { timeout: 120000 });
    await page.waitForTimeout(2600);
    const info = await page.evaluate(() => {
      const app = (window as unknown as { __stillwater?: any }).__stillwater;
      if (!app) return null;
      const gl = app.post.renderer.getContext() as WebGL2RenderingContext;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        programs: app.post.renderer.info.programs?.length,
        calls: app.post.renderer.info.render.calls,
        triangles: app.post.renderer.info.render.triangles,
      };
    });
    console.log(info);
    const suffix = dpr > 1 ? `@${dpr}x` : '';
    await page.screenshot({ path: `${output}/${view.name}${suffix}${debugArg ? `-${debugArg}` : ''}.png` });
  }

  if (messages.length) {
    console.log('\n--- browser messages ---');
    messages.forEach((m) => console.log(m));
  } else {
    console.log('\nNo browser errors.');
  }
  await browser.close();
  if (server) {
    server.kill();
    setTimeout(() => process.exit(0), 500);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
