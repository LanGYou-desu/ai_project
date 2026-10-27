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
await page.waitForTimeout(800);
const t0 = Date.now();
await page.evaluate(() => window.__hollow.debugChapter(0));
await page.waitForTimeout(2500);
console.log('debugChapter ms', Date.now() - t0);
console.log('state', await page.evaluate(() => JSON.stringify(window.__hollow.getState(), null, 2)));
const sceneInfo = await page.evaluate(() => {
  const g = window.__hollow;
  const s = g.scene;
  const cam = g.camera;
  const out = { children: s.children.length, meshes: [], lights: [], camera: {} };
  cam.updateMatrixWorld(true);
  out.camera = { local: cam.position.toArray(), world: cam.getWorldPosition(new cam.position.constructor()).toArray(), rot: [cam.rotation.x, cam.rotation.y, cam.rotation.z], fov: cam.fov, layers: cam.layers.mask, parent: cam.parent?.type };
  s.traverse((o) => {
    if (o.isMesh) {
      const geo = o.geometry;
      geo.computeBoundingSphere?.();
      out.meshes.push({
        name: o.name, type: o.type, visible: o.visible, layers: o.layers.mask,
        position: o.position.toArray(), verts: geo.attributes.position?.count,
        hasColor: !!geo.attributes.color, hasUV: !!geo.attributes.uv,
        bs: geo.boundingSphere ? { c: geo.boundingSphere.center.toArray(), r: geo.boundingSphere.radius } : null,
        mat: { type: o.material.type, vertexColors: o.material.vertexColors, color: o.material.color?.getHexString(), transparent: o.material.transparent, opacity: o.material.opacity, visible: o.material.visible }
      });
    }
    if (o.isLight) out.lights.push({ type: o.type, intensity: o.intensity, visible: o.visible, position: o.getWorldPosition(new o.position.constructor()).toArray() });
  });
  return out;
});
console.log('sceneInfo', JSON.stringify(sceneInfo, null, 2).slice(0, 12000));
await page.screenshot({ path: path.join(OUT, '10-debug-normal.png') });
await page.evaluate(() => {
  const g = window.__hollow;
  g.renderPipeline.postMaterial.uniforms.exposure.value = 4;
  g.scene.fog = null;
  g.scene.background.setHex(0x333333);
  g.scene.traverse((o) => {
    if (o.isLight && o.isHemisphereLight) o.intensity = 4;
    if (o.isMesh && o.material && !o.material.isShaderMaterial) {
      o.material.vertexColors = false;
      o.material.color.setHex(0xaaaaaa);
      o.material.map = null;
      o.material.needsUpdate = true;
    }
  });
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, '11-debug-flat.png') });
await page.evaluate(() => {
  const g = window.__hollow;
  g.debugTeleport(0, 16, 0.4, 0);
});
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, '12-debug-flat-moved.png') });
console.log('--- logs ---');
console.log(logs.slice(0, 60).join('\n'));
await browser.close();
