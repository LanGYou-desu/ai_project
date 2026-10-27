import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => { window.__hollow.debugChapter(0); });
await page.waitForFunction(() => window.__hollow.state === 'playing', null, { timeout: 120000 });
await page.waitForTimeout(1200);
const info = () => page.evaluate(() => ({
  state: window.__hollow.state,
  locked: document.pointerLockElement?.id || null,
  pos: [+window.__hollow.player.position.x.toFixed(2), +window.__hollow.player.position.z.toFixed(2)],
  crouched: window.__hollow.player.crouched,
  flash: window.__hollow.player.flashlightOn,
  stamina: +window.__hollow.player.stamina.toFixed(2),
  pauseVisible: !document.getElementById('pause-screen').classList.contains('is-hidden'),
  journalVisible: !document.getElementById('journal-modal').classList.contains('is-hidden')
}));
console.log('start', await info());
// Click canvas to request pointer lock as a user gesture.
await page.click('#game-canvas', { position: { x: 640, y: 360 } }).catch((e) => console.log('canvas click', e.message.split('\n')[0]));
await page.waitForTimeout(500);
console.log('after click', await info());
await page.keyboard.down('KeyW');
await page.waitForTimeout(800);
await page.keyboard.up('KeyW');
console.log('after W', await info());
await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyW');
await page.waitForTimeout(900);
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
console.log('after sprint', await info());
await page.keyboard.press('KeyC');
await page.waitForTimeout(400);
console.log('after C', await info());
await page.keyboard.press('KeyC');
await page.waitForTimeout(300);
await page.keyboard.press('KeyF');
await page.waitForTimeout(400);
console.log('after F', await info());
await page.keyboard.press('KeyF');
await page.waitForTimeout(200);
await page.keyboard.press('KeyJ');
await page.waitForTimeout(500);
console.log('after J', await info());
await page.keyboard.press('KeyJ');
await page.waitForTimeout(400);
console.log('after J close', await info());
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
console.log('after Escape', await info());
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
console.log('after Escape 2', await info());
// Click pause resume button if present.
console.log('pause buttons', await page.locator('#pause-screen button').allTextContents());
await browser.close();
