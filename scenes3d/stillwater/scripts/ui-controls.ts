import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const failures: string[] = [];
  page.on('pageerror', (e) => failures.push(`pageerror: ${e.stack ?? e.message}`));
  page.on('response', (r) => { if (r.status() === 404) failures.push(`404: ${r.url()}`); });

  const mode = () => page.evaluate(() => (window as any).__stillwater.mode as string);
  const label = (id: string) => page.evaluate((i) => document.getElementById(i)?.textContent ?? '', id);

  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__stillwater?.ready), null, { timeout: 180000 });
  await page.waitForTimeout(1000);

  await page.click('#enter-btn');
  await page.waitForFunction(() => (window as any).__stillwater.mode === 'cinematic');
  await page.waitForTimeout(900);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__stillwater.mode === 'drift');
  await page.waitForSelector('#end-card.visible');
  await page.click('#explore-btn');
  await page.waitForFunction(() => (window as any).__stillwater.mode === 'drift');
  await page.waitForSelector('#hud.visible');

  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => (window as any).__stillwater.mode === 'cinematic');
  if (!(await page.locator('#cinematic').evaluate((el) => el.classList.contains('visible')))) failures.push('replay: cinematic overlay not visible');
  await page.waitForSelector('#cine-title.show', { timeout: 3000 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__stillwater.mode === 'drift');
  await page.waitForSelector('#end-card.visible');
  await page.click('#explore-btn');
  await page.waitForSelector('#hud.visible');

  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => (window as any).__stillwater.mode === 'photo');
  const before = { exp: await label('photo-exp'), fov: await label('photo-fov'), lens: await label('photo-lens') };
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('BracketRight');
  await page.keyboard.press('BracketRight');
  await page.waitForTimeout(300);
  const after = { exp: await label('photo-exp'), fov: await label('photo-fov'), lens: await label('photo-lens') };
  if (before.exp === after.exp) failures.push('photo exposure did not change');
  if (before.fov === after.fov) failures.push('photo lens did not change');
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => (window as any).__stillwater.mode === 'drift');
  const restored = { exp: await label('photo-exp'), fov: await label('photo-fov') };
  if (restored.exp !== '0.0' || restored.fov !== '45mm') failures.push(`photo labels not restored: ${JSON.stringify(restored)}`);

  console.log(JSON.stringify({
    finalMode: await mode(),
    replay: 'ok',
    photoBefore: before,
    photoAfter: after,
    restored,
    failures,
  }, null, 2));
  await browser.close();
  if (failures.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
