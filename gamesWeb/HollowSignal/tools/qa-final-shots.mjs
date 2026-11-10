import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.resolve('qa-output');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'debug') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));
const waitPlaying = () => page.waitForFunction(() => window.__hollow.state === 'playing' && window.__hollow.input.enabled, null, { timeout: 120000 });

await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => { window.__hollow.debugChapter(3); });
await waitPlaying();
await page.waitForTimeout(2000);

// Long note geometry/scrolling.
await page.evaluate(() => window.__hollow.debugTeleportToItem('final cassette'));
await page.waitForTimeout(700);
await page.keyboard.press('KeyE');
await page.waitForTimeout(900);
const geometry = await page.evaluate(() => {
  const paper = document.querySelector('#note-modal .paper');
  const body = document.querySelector('#note-modal .note-body');
  const footer = document.querySelector('#note-modal .paper-footer');
  const pr = paper.getBoundingClientRect();
  const br = body.getBoundingClientRect();
  const fr = footer.getBoundingClientRect();
  return { paper: { top: pr.top, bottom: pr.bottom, h: pr.height }, body: { top: br.top, bottom: br.bottom, h: br.height, scroll: body.scrollHeight }, footer: { top: fr.top, bottom: fr.bottom }, footerVisible: fr.bottom <= pr.bottom + 1 };
});
console.log('long note', geometry);
await page.screenshot({ path: path.join(OUT, 'final-01-long-note.png') });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// Choice and both endings.
await page.evaluate(() => window.__hollow.openFinalChoice());
await page.waitForSelector('#choice-modal:not(.is-hidden)');
await page.waitForTimeout(700);
console.log('choice state', await page.evaluate(() => window.__hollow.state));
await page.screenshot({ path: path.join(OUT, 'final-02-choice.png') });
await page.click('#choice-a');
await page.waitForSelector('#ending-screen:not(.is-hidden)');
await page.waitForTimeout(3200);
console.log('ending', await page.locator('#ending-title').textContent(), await page.locator('#ending-kicker').textContent());
await page.screenshot({ path: path.join(OUT, 'final-03-ending-still-water.png') });

await page.evaluate(() => { window.__hollow.debugChapter(3); });
await waitPlaying();
await page.waitForTimeout(1800);
await page.evaluate(() => window.__hollow.openFinalChoice());
await page.waitForSelector('#choice-modal:not(.is-hidden)');
await page.waitForTimeout(500);
await page.click('#choice-b');
await page.waitForSelector('#ending-screen:not(.is-hidden)');
await page.waitForTimeout(3200);
console.log('ending2', await page.locator('#ending-title').textContent(), await page.locator('#ending-kicker').textContent());
await page.screenshot({ path: path.join(OUT, 'final-04-ending-the-hollow.png') });

// Menu with a save, then fresh menu.
await page.evaluate(() => window.__hollow.quitToTitle());
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(OUT, 'final-05-menu.png') });
console.log('logs', logs.join('\n'));
await browser.close();
