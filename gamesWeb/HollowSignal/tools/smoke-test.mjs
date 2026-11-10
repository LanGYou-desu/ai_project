#!/usr/bin/env node
/**
 * End-to-end smoke test for THE HOLLOW SIGNAL.
 *
 * It boots its own static server, launches Microsoft Edge through
 * playwright-core, plays through all four chapters with real input, and
 * exercises both endings. Run with: npm test
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'qa-output');
const PORT = 4186;
const URL = `http://127.0.0.1:${PORT}/`;
fs.mkdirSync(OUT, { recursive: true });

const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);
const edge = EDGE_CANDIDATES.find((p) => fs.existsSync(p));

let server = null;
let browser = null;
let failures = 0;
let checks = 0;

function ok(condition, message, extra = null) {
  checks++;
  if (condition) {
    console.log(`  ok  ${message}`);
  } else {
    failures++;
    console.error(`FAIL  ${message}${extra ? ` :: ${JSON.stringify(extra)}` : ''}`);
  }
}

async function waitForServer(timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(URL);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Server did not answer on ${URL}`);
}

async function run() {
  server = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d.toString(); });
  server.stderr.on('data', (d) => { serverLog += d.toString(); });
  await waitForServer();
  console.log(`Server ready at ${URL}`);

  const launchOptions = {
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
  };
  if (edge) launchOptions.executablePath = edge;
  browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  // Keep automated tests from taking over the desktop mouse with the browser's
  // pointer-lock cursor. Keyboard input and all game interactions still work.
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = function requestPointerLock() {
      return Promise.resolve();
    };
    window.__hollowTestNoPointerLock = true;
  });
  page.setDefaultTimeout(20000);
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('favicon')) consoleErrors.push(m.text());
  });

  const state = () => page.evaluate(() => window.__hollow.getState());
  const bodyText = (selector) => page.locator(selector).textContent();
  // While pointer lock is active, Playwright's physical mouse click moves the
  // cursor and injects a large look delta into the game. Use a DOM click for
  // in-game overlays so the camera stays where the test put it.
  const clickDom = async (selector) => {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Missing element: ${sel}`);
      el.click();
    }, selector);
  };
  const waitPlaying = async (timeout = 120000) => {
    await page.waitForFunction(
      () => window.__hollow?.state === 'playing' && window.__hollow?.input?.enabled,
      null,
      { timeout }
    );
    await page.evaluate(() => window.__hollow?.ui?.hideClickResume?.());
    await page.waitForTimeout(250);
  };
  const waitIntroAndEnter = async (timeout = 90000) => {
    await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout });
    await page.waitForTimeout(1000);
    const visible = await page.locator('#enter-button').isVisible();
    ok(visible, 'intro Enter button is visible');
    await clickDom('#enter-button');
    await waitPlaying();
  };
  const waitInteraction = async (needle, timeout = 15000) => {
    try {
      await page.waitForFunction((text) => {
        const g = window.__hollow;
        return g?.state === 'playing' && (g.currentInteraction?.getLabel?.() || '').toLowerCase().includes(text.toLowerCase());
      }, needle, { timeout });
    } catch (err) {
      const diag = await page.evaluate(() => {
        const g = window.__hollow;
        return {
          state: g?.state,
          inputEnabled: g?.input?.enabled,
          current: g?.currentInteraction?.getLabel?.() || null,
          player: g ? { x: g.player.position.x, z: g.player.position.z, y: g.player.position.y } : null,
          pointerLocked: g?.input?.locked ?? null,
          chapter: g?.chapterIndex
        };
      }).catch(() => null);
      console.error(`  diagnostic while waiting for "${needle}":`, JSON.stringify(diag));
      throw err;
    }
  };
  const interactAt = async (needle, expectLabel = needle) => {
    await ensurePlaying();
    const found = await page.evaluate((needle) => window.__hollow.debugTeleportToItem(needle), needle);
    ok(!!found, `found interaction "${needle}"`, found);
    await page.waitForTimeout(250);
    // A synthetic click used to close a document can leave a pending pointer-lock
    // movement event that rotates the view after the first teleport. Re-place the
    // camera once those events have drained so this helper stays deterministic.
    await page.evaluate((needle) => {
      const g = window.__hollow;
      g.input.consumeMouse();
      return g.debugTeleportToItem(needle);
    }, needle);
    await page.waitForTimeout(450);
    await page.evaluate(() => window.__hollow.input.consumeMouse());
    await waitInteraction(expectLabel);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(700);
  };
  const closeNote = async () => {
    if (await page.evaluate(() => window.__hollow.state === 'modal')) {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 10000 });
      await page.waitForTimeout(250);
    }
    // A lost pointer lock can synchronously pause the game while a document
    // closes in a headless browser. Recover the same way a player would.
    if (await page.evaluate(() => window.__hollow.state === 'paused')) {
      await clickDom('[data-action="resume"]').catch(() => {});
      await waitPlaying();
    }
  };
  const ensurePlaying = async () => {
    if (await page.evaluate(() => window.__hollow.state === 'paused')) {
      await clickDom('[data-action="resume"]').catch(() => {});
      await waitPlaying();
    }
  };
  const screenshot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `smoke-${name}.png`) });
  };

  try {
    /* --------------------------------------------------------------- */
    console.log('\n[1] Boot / menu / settings');
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__hollow, null, { timeout: 60000 });
    await page.waitForFunction(() => window.__hollow.state === 'menu', null, { timeout: 30000 });
    await page.waitForTimeout(900);
    ok(await page.locator('#menu-screen').isVisible(), 'menu is visible');
    ok(await page.locator('#continue-button').isHidden(), 'continue is hidden without a save');
    ok(await page.locator('#loading-screen').isHidden(), 'loading screen is dismissed');
    await screenshot('01-menu');

    await page.click('[data-action="settings"]');
    await page.waitForSelector('#settings-screen:not(.is-hidden)');
    const quality = async () => page.evaluate(() => {
      const g = window.__hollow;
      return {
        name: g.settings.qualityName,
        scale: g.renderPipeline.dynamicScale,
        rt: [g.renderPipeline.rt.width, g.renderPipeline.rt.height],
        msaa: g.renderPipeline.rt.samples
      };
    });
    const medium = await quality();
    await page.click('[data-quality="low"]');
    await page.waitForTimeout(350);
    const low = await quality();
    ok(low.name === 'low' && low.rt[0] < medium.rt[0], 'Low preset lowers render resolution', { medium, low });
    await page.click('[data-quality="high"]');
    await page.waitForTimeout(400);
    const high = await quality();
    ok(high.name === 'high' && high.rt[0] > low.rt[0], 'High preset raises render resolution', { low, high });
    ok(high.msaa >= 4, 'High preset enables 4x MSAA', high);
    await page.click('[data-quality="medium"]');
    await page.waitForTimeout(300);
    await page.click('[data-close="settings"]');
    await page.waitForTimeout(300);
    ok(await page.locator('#menu-screen').isVisible(), 'settings sheet closes back to menu');

    /* --------------------------------------------------------------- */
    console.log('\n[2] New game, intro, controls');
    await page.click('[data-action="new-game"]');
    const introShown = await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout: 90000 }).catch(() => null);
    ok(!!introShown, 'chapter I intro appears');
    ok((await bodyText('#intro-lines')).includes('哈尔西恩站'), 'chapter I intro text is present');
    await screenshot('02-intro');
    await page.waitForTimeout(1100);
    await clickDom('#enter-button');
    await waitPlaying();
    let s = await state();
    ok(s.chapter === 0 && s.chapterTitle === '低水位', 'entered Chapter I', s.chapterTitle);
    ok(s.audio.ready === true, 'WebAudio unlocked');
    ok(s.audio.ambient === 'lowWater', 'streamed Chapter I ambience is active', s.audio);
    ok(s.level.colliders > 20 && s.level.bakedLights > 0, 'Chapter I collision + baked-light data built', s.level);
    ok(s.level.drawCalls > 10 && s.level.triangles > 1000, 'Chapter I scene is submitting real geometry', s.level);

    const p0 = await page.evaluate(() => ({ x: window.__hollow.player.position.x, z: window.__hollow.player.position.z }));
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(250);
    const p1 = await page.evaluate(() => ({ x: window.__hollow.player.position.x, z: window.__hollow.player.position.z }));
    ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.25, 'WASD movement works', { p0, p1 });

    await page.keyboard.press('KeyC');
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => window.__hollow.player.crouched), 'C toggles crouch');
    await page.keyboard.press('KeyC');
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(300);
    ok(!(await page.evaluate(() => window.__hollow.player.flashlightOn)), 'F toggles flashlight');
    await page.keyboard.press('KeyF');
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(400);
    ok((await state()).state === 'modal' && await page.locator('#journal-modal').isVisible(), 'J opens the journal');
    await page.keyboard.press('KeyJ');
    await page.waitForFunction(() => window.__hollow.state === 'playing');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    ok((await state()).state === 'paused' && await page.locator('#pause-screen').isVisible(), 'Escape pauses');
    await clickDom('[data-action="resume"]');
    await waitPlaying();

    /* --------------------------------------------------------------- */
    console.log('\n[3] Chapter I: card, reader, lift');
    await interactAt('检修卡', '检修卡');
    s = await state();
    ok(s.items.keycard === true, 'service keycard collected');
    ok(s.objective.includes('安保门'), 'objective advances to the card reader', s.objective);

    await interactAt('读卡器', '读卡器');
    await page.waitForTimeout(1100);
    s = await state();
    ok(await page.evaluate(() => window.__hollow.level.securityDoor.openState > .8), 'security door opens after card read');
    ok(s.objective.includes('检修电梯'), 'objective advances to the lift', s.objective);

    await interactAt('检修电梯', '检修电梯');
    await waitIntroAndEnter();
    s = await state();
    ok(s.chapter === 1 && s.chapterTitle === '聆听层', 'lift reaches Chapter II', s.chapterTitle);
    ok(s.audio.ambient === 'listeningFloor', 'Chapter II ambience is active', s.audio);

    /* --------------------------------------------------------------- */
    console.log('\n[4] Save / continue');
    const saveRaw = await page.evaluate(() => localStorage.getItem('hollow-signal.save.v1'));
    ok(!!saveRaw && JSON.parse(saveRaw).chapter === 1, 'progress is saved at Chapter II', saveRaw);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__hollow?.state === 'menu', null, { timeout: 60000 });
    await page.waitForTimeout(700);
    ok(await page.locator('#continue-button').isVisible(), 'continue is visible after reload');
    ok((await page.locator('#continue-chapter').textContent()).includes('02'), 'continue card shows Chapter II');
    await page.click('[data-action="continue"]');
    await waitIntroAndEnter();
    s = await state();
    ok(s.chapter === 1 && s.objective.includes('辅助电源'), 'continue resumes Chapter II at the objective', s.objective);

    /* --------------------------------------------------------------- */
    console.log('\n[5] Chapter II: records, fuses, breaker, badge, lift');
    const tape = await page.evaluate(() => window.__hollow.debugTeleportToItem('磁带'));
    ok(!!tape, 'Wren cassette is present');
    await page.waitForTimeout(400);
    await waitInteraction('磁带');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(600);
    ok((await state()).state === 'modal', 'cassette opens a recovered-audio document');
    ok(await page.evaluate(() => window.__hollow.hasRecord('tape-wren-1')), 'tape-wren-1 archived');
    await closeNote();

    await interactAt('晶格计划附录', '晶格计划附录');
    ok(await page.evaluate(() => window.__hollow.hasRecord('array-memo')), 'array-memo archived');
    await closeNote();

    for (const fuse of ['保险丝 A', '保险丝 B', '保险丝 C']) {
      await interactAt(fuse, fuse);
    }
    ok(await page.evaluate(() => window.__hollow.level.fuses.size === 3), 'all three ceramic fuses collected');

    await interactAt('主断路器', '主断路器');
    await page.waitForTimeout(1300);
    s = await state();
    ok(await page.evaluate(() => window.__hollow.level.powerOn), 'breaker restores power');
    ok(s.level.bakedLights >= 6, 'breaker rebakes the level lighting', s.level);
    ok(s.objective.includes('工牌'), 'objective advances to the badge', s.objective);
    await page.waitForTimeout(1200);
    ok(await page.evaluate(() => window.__hollow.level.silhouetteShown && window.__hollow.level.listener.root.visible), 'observation-window silhouette appears');

    await interactAt('工牌', '工牌');
    ok((await state()).state === 'modal', 'badge opens its personnel document');
    ok(await page.evaluate(() => window.__hollow.hasRecord('badge-wren')), 'badge-wren archived');
    await closeNote();
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => window.__hollow.hasRecord('badge-wren')), 'badge record persists after closing');
    await screenshot('03-chapter2-badge');

    await interactAt('货运电梯', '货运电梯');
    await waitIntroAndEnter();
    s = await state();
    ok(s.chapter === 2 && s.chapterTitle === '薄墙', 'freight lift reaches Chapter III', s.chapterTitle);
    ok(await page.evaluate(() => window.__hollow.hasRecord('badge-wren')), 'records persist across chapters');

    /* --------------------------------------------------------------- */
    console.log('\n[6] Chapter III: keypad, hiding, death, chase');
    await page.waitForTimeout(600);
    await interactAt('安保键盘', '安保键盘');
    ok((await state()).state === 'modal' && await page.locator('#keypad-modal').isVisible(), 'security keypad opens');
    for (const key of ['9', '9', '9', '9']) await page.keyboard.press(`Digit${key}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    ok(await page.evaluate(() => window.__hollow.ui.keypadState.open), 'wrong code leaves the keypad open for retry');
    ok(await page.evaluate(() => window.__hollow.ui.keypadState.locked === false), 'wrong code releases the keypad lock');
    ok(!(await page.evaluate(() => window.__hollow.level.officeOpened)), 'wrong code does not unlock the office');
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => window.__hollow.ui.keypadState.digits === ''), 'wrong code clears the entered digits');
    for (const key of ['0', '3', '1', '7']) await page.keyboard.press(`Digit${key}`);
    await page.keyboard.press('Enter');
    await waitPlaying();
    await page.waitForTimeout(900);
    ok(await page.evaluate(() => window.__hollow.level.officeOpened), 'code 0317 unlocks the office after a retry');

    await interactAt('躲进储物柜', '躲进储物柜');
    ok(await page.evaluate(() => window.__hollow.player.hidden), 'E enters a hiding locker');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);
    ok(!(await page.evaluate(() => window.__hollow.player.hidden)), 'E leaves the hiding locker');

    await page.evaluate(() => window.__hollow.debugKill());
    await page.waitForTimeout(500);
    ok((await state()).state === 'dying', 'death state begins');
    await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 15000 });
    ok(true, 'player respawns after death');

    await interactAt('变电站保险丝', '变电站保险丝');
    ok((await state()).items.fuse === true, 'substation fuse collected');
    await interactAt('陶瓷保险丝', '陶瓷保险丝');
    await page.waitForFunction(() => window.__hollow.level.chaseActive, null, { timeout: 6000 }).catch(() => {});
    ok(await page.evaluate(() => window.__hollow.level.chaseActive), 'substation starts the scripted chase');
    ok((await state()).objective.includes('快跑'), 'objective switches to escape', (await state()).objective);

    // Face the exit and sprint for the lift. This is the same route a player uses.
    await page.evaluate(() => window.__hollow.debugTeleport(0, -19.9, Math.PI, 0));
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__hollow.chapterIndex === 3 || window.__hollow.state === 'dying', null, { timeout: 20000 }).catch(() => {});
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    s = await state();
    ok(s.state !== 'dying', 'sprint route escapes the Listener', s);
    await waitIntroAndEnter();
    s = await state();
    ok(s.chapter === 3 && s.chapterTitle === '空洞', 'lift reaches Chapter IV', s.chapterTitle);

    /* --------------------------------------------------------------- */
    console.log('\n[7] Chapter IV: letter, gallery, final tape, endings');
    await interactAt('外套口袋', '外套口袋');
    ok(await page.evaluate(() => window.__hollow.hasRecord('iris-letter')), 'Iris letter archived');
    await closeNote();

    await page.evaluate(() => window.__hollow.debugTeleport(0, 2.55, 0, 0));
    await page.waitForFunction(() => window.__hollow.level.inGallery === true, null, { timeout: 15000 }).catch(() => {});
    ok(await page.evaluate(() => window.__hollow.level.inGallery), 'gallery threshold trigger fires');
    ok((await state()).objective.includes('共振控制台'), 'objective advances to the resonance console', (await state()).objective);

    await interactAt('最终磁带', '最终磁带');
    ok((await state()).state === 'modal', 'final cassette opens Wren’s last record');
    ok(await page.evaluate(() => window.__hollow.hasRecord('wren-final')), 'wren-final archived');
    await screenshot('04-final-note');
    await closeNote();

    // The console stays in reach after the document closes; its label changes
    // from "Examine the final cassette" to "Start the final playback".
    await waitInteraction('最终播放');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(700);
    ok(await page.evaluate(() => window.__hollow.level.tapeStarted), 'final tape playback starts');
    await page.waitForTimeout(1200);
    const subtitle = await bodyText('#subtitle-text');
    ok(subtitle.length > 0, 'final tape subtitles are shown', subtitle);
    await page.waitForSelector('#choice-modal:not(.is-hidden)', { timeout: 60000 });
    ok((await state()).state === 'choice', 'final choice opens after the tape');
    await page.waitForTimeout(500);
    await screenshot('05-choice');

    await page.click('#choice-a');
    await page.waitForSelector('#ending-screen:not(.is-hidden)', { timeout: 15000 });
    await page.waitForTimeout(3000);
    ok((await bodyText('#ending-kicker')).includes('静水'), 'purge ending shows Still Water');
    ok((await bodyText('#ending-title')) === '湖安静了。', 'purge ending title is correct');
    ok((await bodyText('#ending-body')).includes('断路器'), 'purge ending prose is present');
    await screenshot('06-ending-still-water');

    // Second ending through its real UI, without replaying the full tape.
    await page.evaluate(() => { window.__hollow.debugChapter(3); });
    await waitPlaying();
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__hollow.openFinalChoice());
    await page.waitForSelector('#choice-modal:not(.is-hidden)', { timeout: 10000 });
    await page.click('#choice-b');
    await page.waitForSelector('#ending-screen:not(.is-hidden)', { timeout: 15000 });
    await page.waitForTimeout(3000);
    ok((await bodyText('#ending-kicker')).includes('空洞'), 'answer ending shows The Hollow');
    ok((await bodyText('#ending-title')) === '导线记得。', 'answer ending title is correct');
    await screenshot('07-ending-the-hollow');

    /* --------------------------------------------------------------- */
    console.log('\n[8] Error + teardown checks');
    ok(pageErrors.length === 0, 'no uncaught page errors', pageErrors);
    ok(consoleErrors.length === 0, 'no console errors', consoleErrors);
    s = await state();
    console.log(`  info  final draw calls=${s.level?.drawCalls}, triangles=${s.level?.triangles}, quality=${await page.evaluate(() => window.__hollow.settings.qualityName)}`);
  } finally {
    await browser?.close().catch(() => {});
    server?.kill();
  }

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) {
    console.error(`${failures} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log('SMOKE TEST PASSED');
  }
}

run().catch((err) => {
  console.error('\nSMOKE TEST CRASHED');
  console.error(err);
  try { server?.kill(); } catch {}
  process.exitCode = 1;
});
