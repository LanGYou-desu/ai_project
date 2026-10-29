import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:4173/';
const OUT = path.resolve('qa-output', 'ui-shots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: true,
  args: [
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required'
  ]
});

const waitPlaying = (page) => page.waitForFunction(
  () => window.__hollow.state === 'playing' && window.__hollow.input.enabled,
  null,
  { timeout: 120000 }
);

async function capture(width, height) {
  const tag = `${width}x${height}`;
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGE ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  await page.addInitScript(() => {
    // Automated captures must never take over the desktop cursor.
    HTMLCanvasElement.prototype.requestPointerLock = function requestPointerLock() {
      return Promise.resolve();
    };
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hollow, null, { timeout: 60000 });
  await page.evaluate(() => window.__hollow.settings.set('quality', 'high'));
  await page.waitForTimeout(900);

  const fontStatus = await page.evaluate(() => ({
    sans: document.fonts.check('16px "Noto Sans SC"'),
    serif: document.fonts.check('16px "Noto Serif SC"'),
    zh: document.documentElement.lang
  }));

  // Menu.
  await page.screenshot({ path: path.join(OUT, `${tag}-menu.png`) });

  // Menu sheets.
  for (const action of ['settings', 'controls', 'credits']) {
    await page.click(`[data-action="${action}"]`);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(OUT, `${tag}-${action}.png`) });
    await page.click(`[data-close="${action}"]`);
    await page.waitForTimeout(250);
  }

  // Intro.
  await page.evaluate(() => { window.__hollow.debugChapter(0, { intro: true }).catch(console.error); });
  await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout: 120000 });
  await page.waitForTimeout(2800);
  await page.screenshot({ path: path.join(OUT, `${tag}-intro.png`) });
  await page.evaluate(() => document.getElementById('enter-button').click());
  await waitPlaying(page);
  await page.waitForTimeout(1000);

  // HUD + objective.
  await page.screenshot({ path: path.join(OUT, `${tag}-hud.png`) });

  // Pause.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${tag}-pause.png`) });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);

  // Chapter card typography.
  await page.evaluate(async () => {
    const { getChapter } = await import('/src/story/content.js');
    const chapter = getChapter(0);
    window.__hollow.ui.showChapterCard({
      number: '第 一 章',
      title: chapter.title,
      quote: chapter.quote,
      meta: chapter.meta
    });
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, `${tag}-chapter-card.png`) });
  await page.evaluate(() => window.__hollow.ui.hideChapterCard());
  await page.waitForTimeout(300);

  // Recovered document.
  await page.evaluate(async () => {
    const { getRecord } = await import('/src/story/content.js');
    window.__hollow.openNote(getRecord('incident-clipping'));
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${tag}-note.png`) });
  await page.evaluate(() => window.__hollow.closeNote());
  await page.waitForTimeout(300);

  // Journal with recovered records visible.
  await page.evaluate(async () => {
    const { RECORDS } = await import('/src/story/content.js');
    const g = window.__hollow;
    g._records = Object.values(RECORDS).slice(0, 6).map((r) => ({ ...r }));
    g._recordIds = new Set(g._records.map((r) => r.id));
    g.openJournal();
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${tag}-journal.png`) });
  await page.evaluate(() => window.__hollow.closeJournal());
  await page.waitForTimeout(250);

  // Keypad.
  await page.evaluate(() => window.__hollow.ui.openKeypad({ length: 4 }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${tag}-keypad.png`) });
  await page.evaluate(() => window.__hollow.ui.closeKeypad());
  await page.waitForTimeout(300);

  // Final choice in the resonance gallery.
  await page.evaluate(() => window.__hollow.debugChapter(3));
  await waitPlaying(page);
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const g = window.__hollow;
    g.debugTeleport(0, -2.2, 0, -.02);
    g.debugLookAt(0, -10, 2.1);
    g.openFinalChoice();
  });
  await page.waitForSelector('#choice-modal:not(.is-hidden)', { timeout: 10000 });
  await page.waitForTimeout(650);
  await page.screenshot({ path: path.join(OUT, `${tag}-choice.png`) });

  // First ending.
  await page.click('#choice-a');
  await page.waitForSelector('#ending-screen:not(.is-hidden)', { timeout: 10000 });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: path.join(OUT, `${tag}-ending-still-water.png`) });

  // Second ending.
  await page.evaluate(() => window.__hollow.debugChapter(3));
  await waitPlaying(page);
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const g = window.__hollow;
    g.debugTeleport(0, -2.2, 0, -.02);
    g.debugLookAt(0, -10, 2.1);
    g.openFinalChoice();
  });
  await page.waitForSelector('#choice-modal:not(.is-hidden)', { timeout: 10000 });
  await page.waitForTimeout(450);
  await page.click('#choice-b');
  await page.waitForSelector('#ending-screen:not(.is-hidden)', { timeout: 10000 });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: path.join(OUT, `${tag}-ending-the-hollow.png`) });

  console.log(tag, JSON.stringify(fontStatus), errors.length ? errors : 'no page errors');
  await context.close();
}

await capture(1280, 720);
await capture(1600, 900);
await browser.close();
