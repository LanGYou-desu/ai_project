import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const messages: string[] = [];
  const pageErrors: string[] = [];
  const missing: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') messages.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => pageErrors.push(e.stack ?? e.message));
  page.on('response', (r) => { if (r.status() === 404) missing.push(r.url()); });
  page.on('requestfailed', (r) => missing.push(`${r.url()} (${r.failure()?.errorText ?? 'request failed'})`));

  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__stillwater?.ready), null, { timeout: 180000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'shots/ui-title.png' });

  await page.click('#enter-btn');
  await page.waitForSelector('#cinematic.visible', { timeout: 5000 });
  await page.waitForSelector('#cine-title.show', { timeout: 8000 });
  await page.waitForTimeout(1700);
  await page.screenshot({ path: 'shots/ui-cinematic.png' });

  await page.keyboard.press('Escape');
  await page.waitForSelector('#end-card.visible', { timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'shots/ui-endcard.png' });

  await page.click('#explore-btn');
  await page.waitForSelector('#hud.visible', { timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'shots/ui-hud.png' });

  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => document.body.classList.contains('photo'), null, { timeout: 5000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'shots/ui-photo.png' });

  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => !document.body.classList.contains('photo'), null, { timeout: 5000 });
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyM');
  await page.waitForFunction(
    () => (document.getElementById('toast')?.textContent ?? '').includes('SOUND OFF'),
    null,
    { timeout: 5000 },
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/ui-muted.png' });

  const filtered = messages.filter(
    (m) => !m.includes('Failed to load resource') && !m.includes('bake volume /bake/fog'),
  );
  if (filtered.length) console.log(filtered.join('\n'));
  if (missing.length) console.log(`missing resources:\n${[...new Set(missing)].join('\n')}`);
  if (pageErrors.length) console.log(`page errors:\n${pageErrors.join('\n\n')}`);
  if (!filtered.length && !missing.length && !pageErrors.length) console.log('no browser errors');
  await browser.close();
  if (pageErrors.length || missing.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
