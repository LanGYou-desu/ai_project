import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.resolve('qa-output');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'debug') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.__hollow);
await page.click('[data-action="new-game"]');
const intro = await page.waitForSelector('#intro-overlay:not(.is-hidden)', { timeout: 180000 });
await page.waitForTimeout(1500);
await page.click('#enter-button');
await page.waitForTimeout(1200);
console.log('state', await page.evaluate(() => window.__hollow.state));
console.log('clickResume visible', await page.locator('#click-resume').isVisible().catch(() => 'no selector'));
console.log('overlays', await page.evaluate(() => [...document.querySelectorAll('[id]')].filter(e => !e.classList.contains('is-hidden') && e.getBoundingClientRect().width > 0).map(e => e.id).slice(0, 30)));
const camInfo = await page.evaluate(() => {
  const g = window.__hollow;
  const cam = g.camera;
  const THREE = g.level.scene.constructor;
  g.scene.updateMatrixWorld(true);
  const dir = cam.getWorldDirection(new cam.position.constructor());
  return {
    state: g.state,
    playing: g.state === 'playing',
    camPos: cam.position.toArray(),
    camWorld: cam.getWorldPosition(new cam.position.constructor()).toArray(),
    camRot: [cam.rotation.x, cam.rotation.y, cam.rotation.z],
    dir: dir.toArray(),
    spotlight: {
      visible: g.player.flashlight.visible,
      intensity: g.player.flashlight.intensity,
      distance: g.player.flashlight.distance,
      angle: g.player.flashlight.angle,
      parent: g.player.flashlight.parent?.type,
      targetWorld: g.player.flashlight.target.getWorldPosition(new cam.position.constructor()).toArray(),
      spotWorld: g.player.flashlight.getWorldPosition(new cam.position.constructor()).toArray(),
      castShadow: g.player.flashlight.castShadow
    },
    static: g.scene.children.filter(o => o.userData.staticBatchKey).map(o => ({
      key: o.userData.staticBatchKey, visible: o.visible,
      count: o.geometry.attributes.position.count,
      hasColor: !!o.geometry.attributes.color,
      colorMinMax: (() => { const c = o.geometry.attributes.color; if (!c) return null; let mn=9,mx=-9; for (let i=0;i<c.count;i++){const v=c.getX(i); if(v<mn)mn=v; if(v>mx)mx=v;} return [mn,mx]; })(),
      matColor: o.material.color?.getHexString(), map: !!o.material.map, vertexColors: o.material.vertexColors
    })),
    hemi: g.scene.children.filter(o => o.isHemisphereLight).map(o => ({ intensity: o.intensity, color: o.color?.getHexString() })),
    lightsAll: (() => { const arr=[]; g.scene.traverse(o=>{if(o.isLight)arr.push({type:o.type,int:o.intensity,vis:o.visible});}); return arr; })()
  };
});
console.log(JSON.stringify(camInfo, null, 2));
await page.evaluate(() => { window.__hollow.ui.hideClickResume(); window.__hollow.ui.hideHint?.(); });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, '20-normal-nodim.png') });

for (const [exposure, flash, tag] of [[1.2, 22, '21-exp12'], [2.4, 22, '22-exp24'], [2.4, 80, '23-flash80'], [3.5, 160, '24-flash160']]) {
  await page.evaluate(({ exposure, flash }) => {
    const g = window.__hollow;
    g.ui.hideClickResume();
    g.renderPipeline.postMaterial.uniforms.exposure.value = exposure;
    g.player.flashlight.intensity = flash;
  }, { exposure, flash });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${tag}.png`) });
}
console.log('--- logs ---');
console.log(logs.filter(l => !l.includes('sigmaRadians')).slice(0, 40).join('\n'));
await browser.close();
