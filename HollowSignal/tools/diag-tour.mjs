import { chromium } from 'playwright-core';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.evaluate(() => {
  const g = window.__hollow;
  const rp = g.renderPipeline;
  const orig = rp.render.bind(rp);
  rp.render = (scene, camera, elapsed, effects = {}) => orig(scene, camera, elapsed, { ...effects, exposure: 3.1 });
  g.player.flashlight.intensity = 260;
  g.player.flashlight.angle = .72;
  g.player.flashlight.penumbra = .45;
  g.player.flashlight.distance = 30;
});
const waitPlaying = () => page.waitForFunction(() => window.__hollow.state === 'playing' && window.__hollow.input.enabled, null, { timeout: 120000 });
const shot = async (name, x, z, yaw, pitch = -.08) => {
  await page.evaluate(({ x, z, yaw, pitch }) => window.__hollow.debugTeleport(x, z, yaw, pitch), { x, z, yaw, pitch });
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelectorAll('#hud, #pause-button, #interaction, #subtitles, #look-hint').forEach((e) => e.style.display = 'none'));
  await page.screenshot({ path: path.join('qa-output', `tour-${name}.png`) });
};

for (const [index, shots] of [
  [0, [['ch1-spawn', 0, 19, Math.PI, -.06], ['ch1-office', -.7, 1.8, -.9, -.1], ['ch1-lift', 0, -5.7, Math.PI, 0]]],
  [1, [['ch2-hall', 0, 7, Math.PI * .96, -.02], ['ch2-office', -2.6, -11.7, -.2, -.05], ['ch2-breaker', -6.5, -5.0, -Math.PI / 2, -.03]]],
  [2, [['ch3-corridor', 0, 10.5, Math.PI, -.03], ['ch3-office', 3.0, -4.4, -Math.PI * .7, -.03], ['ch3-substation', 0, -17.1, Math.PI, -.05]]],
  [3, [['ch4-corridor', 0, 13.3, Math.PI, -.02], ['ch4-gallery', 0, 1.3, Math.PI, -.02], ['ch4-console', 0, .2, Math.PI, -.1]]]
]) {
  await page.evaluate((i) => window.__hollow.debugChapter(i), index);
  await waitPlaying();
  await page.waitForTimeout(1400);
  for (const [name, x, z, yaw, pitch] of shots) await shot(name, x, z, yaw, pitch);
}
await browser.close();
