import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.resolve('qa-output');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'debug') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));

const state = () => page.evaluate(() => window.__hollow.getState());
const waitPlaying = async (timeout = 120000) => {
  await page.waitForFunction(() => window.__hollow?.state === 'playing' && window.__hollow?.input?.enabled, null, { timeout });
  await page.evaluate(() => { window.__hollow?.ui?.hideClickResume?.(); });
};
const waitInteraction = async (needle, timeout = 15000) => {
  await page.waitForFunction((needle) => {
    const g = window.__hollow;
    return g?.state === 'playing' && (g.currentInteraction?.getLabel?.() || '').toLowerCase().includes(needle.toLowerCase());
  }, needle, { timeout });
};
const teleport = async (label, waitNeedle = null) => {
  const found = await page.evaluate((needle) => window.__hollow.debugTeleportToItem(needle), label);
  await page.waitForTimeout(600);
  if (!found) console.log('  !! item not found:', label);
  if (waitNeedle) {
    try { await waitInteraction(waitNeedle); } catch { console.log('  !! interaction did not appear:', waitNeedle); }
  }
  return found;
};
const pressE = async (wait = 900) => {
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(wait);
};
const closeModal = async () => {
  if (await page.evaluate(() => window.__hollow.state === 'modal')) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 10000 });
  }
};

await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => { window.__hollow.debugChapter(3); });
await waitPlaying();
await page.waitForTimeout(2500);
console.log('START', JSON.stringify(await state()));
await page.screenshot({ path: path.join(OUT, '70-ch4-corridor.png') });
await page.waitForTimeout(800);

let f = await teleport('letter in the coat', 'letter in the coat');
console.log('letter found', f?.label, '| label:', await page.locator('#interaction-label').textContent().catch(() => null));
await pressE();
console.log('letter modal?', await page.evaluate(() => window.__hollow.modal), 'state', (await state()).state, 'enabled', await page.evaluate(() => window.__hollow.input.enabled));
await page.screenshot({ path: path.join(OUT, '71-ch4-letter-note.png') });
await closeModal();
await page.waitForTimeout(500);

// Walk the gallery threshold to fire chapter triggers.
await page.evaluate(() => window.__hollow.debugTeleport(0, 2.55, 0, 0));
await page.waitForFunction(() => window.__hollow.level.inGallery === true, null, { timeout: 15000 }).catch(() => {});
console.log('inGallery', await page.evaluate(() => window.__hollow.level.inGallery), 'objective', (await state()).objective);
await page.screenshot({ path: path.join(OUT, '72-ch4-gallery.png') });

f = await teleport('final cassette', 'final cassette');
console.log('console found', f?.label, '| label:', await page.locator('#interaction-label').textContent().catch(() => null));
await pressE();
console.log('console first use -> modal?', await page.evaluate(() => window.__hollow.modal), 'record?', await page.evaluate(() => window.__hollow.hasRecord('wren-final')));
await page.screenshot({ path: path.join(OUT, '73-ch4-final-note.png') });
await closeModal();
await page.waitForTimeout(500);

f = await teleport('final cassette', 'start the final playback');
console.log('console found', f?.label, '| label:', await page.locator('#interaction-label').textContent().catch(() => null));
await pressE(1200);
console.log('tape started?', await page.evaluate(() => window.__hollow.level.tapeStarted), 'tape indicator hidden?', await page.evaluate(() => document.getElementById('tape-indicator').classList.contains('is-hidden')));
await page.screenshot({ path: path.join(OUT, '74-ch4-tape-start.png') });
await page.waitForTimeout(9000);
console.log('mid tape subtitle:', await page.locator('#subtitle-text').textContent().catch(() => null));
await page.screenshot({ path: path.join(OUT, '75-ch4-tape-mid.png') });
await page.waitForSelector('#choice-modal:not(.is-hidden)', { timeout: 50000 });
console.log('CHOICE OPEN state=', (await state()).state);
await page.screenshot({ path: path.join(OUT, '76-ch4-choice.png') });
await page.click('#choice-a');
await page.waitForSelector('#ending-screen:not(.is-hidden)', { timeout: 12000 });
console.log('PURGE ENDING', await page.locator('#ending-kicker').textContent(), '|', await page.locator('#ending-title').textContent());
console.log('ending paragraphs', await page.locator('#ending-body p').count());
await page.screenshot({ path: path.join(OUT, '77-ending-still-water.png') });
await page.waitForTimeout(1200);

// Load chapter 4 again and exercise the other ending through the same UI.
await page.evaluate(() => { window.__hollow.debugChapter(3); });
await waitPlaying();
await page.waitForTimeout(2000);
await page.evaluate(() => window.__hollow.openFinalChoice());
await page.waitForSelector('#choice-modal:not(.is-hidden)', { timeout: 5000 });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, '78-ch4-choice-again.png') });
await page.click('#choice-b');
await page.waitForSelector('#ending-screen:not(.is-hidden)', { timeout: 12000 });
console.log('ANSWER ENDING', await page.locator('#ending-kicker').textContent(), '|', await page.locator('#ending-title').textContent());
await page.screenshot({ path: path.join(OUT, '79-ending-the-hollow.png') });
console.log('FINAL', JSON.stringify(await state()));
console.log('--- logs ---');
console.log(logs.filter(l => !l.includes('sigmaRadians')).slice(0, 50).join('\n'));
await browser.close();
