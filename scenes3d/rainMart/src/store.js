import * as THREE from 'three';
import {
  COLORS,
  MAT,
  toon,
  box,
  sphere,
  cylinder,
  plane,
  mesh,
  applyEdges,
  glowSprite,
  getGlowTexture,
  canvasTexture,
  fillRoundRect,
  clamp,
  smoothstep,
  rand,
  randBetween,
  pick,
  contactShadow,
  COLORS as C,
} from './utils.js';
import { LAYOUT } from './world.js';
import {
  makeStoreSignTexture,
  makeVerticalSignTexture,
  makeOpenSignTexture,
  makeDoormatTexture,
  makeFridgeTexture,
  makeInteriorFloorTexture,
  makeGondolaSignTexture,
  makePosterTexture,
  makeMagazineTexture,
  makeClockTexture,
} from './textures.js';

const S = LAYOUT.STORE;
const FLOOR = 0.42;
const CEIL = 3.72;
const TOP = 5.55;
const facadeZ = 1.8;
const glassZ = 1.81;

/* ---------------------------------------------------------------- */
/*  small local texture builders                                     */
/* ---------------------------------------------------------------- */

function makeGlassRainTexture() {
  return canvasTexture(512, 1024, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const rng = rand;
    for (let i = 0; i < 70; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const len = 22 + rng() * 170;
      const width = 0.6 + rng() * 2.3;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, 'rgba(220,247,255,0)');
      g.addColorStop(0.18, `rgba(220,247,255,${0.12 + rng() * 0.28})`);
      g.addColorStop(0.7, `rgba(220,247,255,${0.08 + rng() * 0.22})`);
      g.addColorStop(1, 'rgba(220,247,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, width, len);
      if (rng() > 0.72) {
        ctx.fillStyle = `rgba(235,252,255,${0.2 + rng() * 0.35})`;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + len, 1 + rng() * 2.5, 2.5 + rng() * 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < 110; i++) {
      const x = rng() * w;
      const y = rng() * h;
      ctx.fillStyle = `rgba(220,246,255,${0.04 + rng() * 0.18})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 0.7 + rng() * 2.4, 1.5 + rng() * 4, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // a couple of lazy, long runs
    ctx.strokeStyle = 'rgba(222,247,255,0.16)';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 9; i++) {
      const x = rng() * w;
      ctx.beginPath();
      ctx.moveTo(x, rng() * h);
      ctx.bezierCurveTo(x + 3, h * 0.35, x - 4, h * 0.68, x + 2, h);
      ctx.stroke();
    }
  }, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeatX: 2.2,
    repeatY: 1.4,
  });
}

function makeGlassSheenTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.filter = 'blur(8px)';
    const stripes = [
      [0.15, 0.5, 0.2, 0.03],
      [0.62, 0.8, 0.08, 0.02],
      [0.72, 0.95, 0.02, 0.015],
    ];
    for (const [x0, x1, a, alpha] of stripes) {
      const g = ctx.createLinearGradient(x0 * w, 0, x1 * w, h);
      g.addColorStop(0, `rgba(208,237,250,0)`);
      g.addColorStop(0.35, `rgba(208,237,250,${a * 0.7})`);
      g.addColorStop(0.55, `rgba(238,250,255,${a})`);
      g.addColorStop(0.8, `rgba(208,237,250,${a * 0.3})`);
      g.addColorStop(1, 'rgba(208,237,250,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 * w - 80, 0);
      ctx.lineTo(x1 * w - 30, 0);
      ctx.lineTo(x0 * w + 40, h);
      ctx.lineTo(x0 * w - 40, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.filter = 'none';
  }, { colorSpace: THREE.SRGBColorSpace });
}

function makeFloorArrowTexture() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(230,194,102,0.7)';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 66);
    ctx.lineTo(w / 2, 138);
    ctx.stroke();
    ctx.fillStyle = 'rgba(230,194,102,0.7)';
    ctx.beginPath();
    ctx.moveTo(w / 2, 44);
    ctx.lineTo(w / 2 - 56, 145);
    ctx.lineTo(w / 2 + 56, 145);
    ctx.closePath();
    ctx.fill();
  });
}

function makePosScreenTexture() {
  return canvasTexture(512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#153338';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9ead9';
    ctx.fillRect(0, 0, w, 47);
    ctx.fillStyle = '#163f41';
    ctx.font = `700 22px "Yu Gothic", sans-serif`;
    ctx.fillText('HOSHIFURU MART   POS', 20, 32);
    ctx.fillStyle = '#cae5d8';
    ctx.font = '500 22px "Trebuchet MS", sans-serif';
    ctx.fillText('点数 003', 28, 98);
    ctx.textAlign = 'right';
    ctx.font = `700 35px "Trebuchet MS", sans-serif`;
    ctx.fillText('¥ 1,280', w - 25, 100);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(142,200,179,0.3)';
    ctx.beginPath();
    ctx.moveTo(22, 125);
    ctx.lineTo(w - 22, 125);
    ctx.stroke();
    ctx.fillStyle = '#e7ba70';
    ctx.font = `600 18px "Yu Gothic", sans-serif`;
    ctx.fillText('お会計ありがとうございます', 24, 162);
    const keys = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    keys.forEach((k) => {
      const x = 40 + (k % 3) * 72;
      const y = 196 + Math.floor(k / 3) * 34;
      ctx.fillStyle = 'rgba(165,205,193,0.12)';
      fillRoundRect(ctx, x, y, 53, 24, 4, 'rgba(165,205,193,0.12)');
    });
    ctx.fillStyle = '#cfeee4';
    ctx.font = `600 16px "Yu Gothic", sans-serif`;
    ctx.fillText('お釣り   ¥ 720', 330, 170);
    ctx.fillStyle = '#c5d7ce';
    ctx.fillText('電子マネー 対応', 330, 204);
  });
}

function makeCigaretteTexture() {
  return canvasTexture(512, 470, (ctx, w, h) => {
    ctx.fillStyle = '#dcdfd0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2c4848';
    ctx.fillRect(0, 0, w, 53);
    ctx.fillStyle = '#edf2e4';
    ctx.font = `700 25px "Yu Gothic", sans-serif`;
    ctx.fillText('たばこ ／ TOBACCO', 20, 35);
    const colors = ['#c95f52', '#d8b15a', '#649e8d', '#557e9c', '#e6e2d2', '#9d7a9e'];
    const rng = rand;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 10; col++) {
        const x = 17 + col * 49;
        const y = 70 + row * 60;
        ctx.fillStyle = 'rgba(36,44,41,0.14)';
        fillRoundRect(ctx, x + 3, y + 3, 39, 45, 4, 'rgba(36,44,41,0.14)');
        ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
        fillRoundRect(ctx, x, y, 39, 45, 4, colors[Math.floor(rng() * colors.length)]);
        ctx.fillStyle = 'rgba(252,247,229,0.7)';
        ctx.fillRect(x + 6, y + 15, 27, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x + 5, y + 5, 3, 34);
      }
      ctx.fillStyle = '#2d4b4b';
      ctx.font = '600 12px "Trebuchet MS", sans-serif';
      ctx.fillText('HOSHIFURU', 20, 121 + row * 60);
    }
    ctx.fillStyle = '#e9ece0';
    ctx.fillRect(0, h - 50, w, 50);
    ctx.fillStyle = '#506461';
    ctx.font = `500 17px "Yu Gothic", sans-serif`;
    ctx.fillText('20歳未満の方は購入できません', 22, h - 20);
  });
}

function makeSaleBannerTexture(text = '新発売', sub = 'NEW ARRIVAL', color = '#e46e57') {
  return canvasTexture(256, 640, (ctx, w, h) => {
    ctx.fillStyle = '#f4ead2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, 74);
    ctx.fillStyle = '#f9f2de';
    ctx.textAlign = 'center';
    ctx.font = '800 34px "Trebuchet MS", sans-serif';
    ctx.fillText('HOSHIFURU', w / 2, 50);
    ctx.fillStyle = '#254b4b';
    ctx.font = `800 72px "Yu Gothic", sans-serif`;
    const chars = text.split('');
    chars.forEach((ch, i) => ctx.fillText(ch, w / 2, 170 + i * 72));
    ctx.fillStyle = color;
    ctx.font = '800 30px "Trebuchet MS", sans-serif';
    ctx.fillText(sub, w / 2, h - 110);
    ctx.strokeStyle = 'rgba(37,75,75,0.34)';
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.textAlign = 'left';
  });
}

function makeInteriorPromoTexture(kind = 'oden') {
  return canvasTexture(360, 500, (ctx, w, h) => {
    if (kind === 'oden') {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#f0d9b0');
      bg.addColorStop(1, '#dc9f69');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#573c30';
      ctx.textAlign = 'center';
      ctx.font = `800 54px "Yu Gothic", sans-serif`;
      ctx.fillText('おでん', w / 2, 88);
      ctx.font = `600 20px "Yu Gothic", sans-serif`;
      ctx.fillText('あったか、はじまりました。', w / 2, 126);
      ctx.fillStyle = '#f5e5c5';
      ctx.beginPath();
      ctx.ellipse(w / 2, 310, 122, 100, 0, 0, Math.PI * 2);
      ctx.fill();
      // little oden items
      const items = ['#d8a45a', '#a87747', '#e5c582', '#b7925b'];
      items.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(w / 2 - 52 + i * 34, 300 + (i % 2) * 29, 24, 19, i * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.strokeStyle = 'rgba(88,60,43,0.6)';
      ctx.lineWidth = 5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 - 30 + i * 30, 250);
        ctx.lineTo(w / 2 - 6 + i * 30, 228);
        ctx.stroke();
      }
      ctx.fillStyle = '#573c30';
      ctx.font = `700 25px "Yu Gothic", sans-serif`;
      ctx.fillText('1品 ¥90 〜', w / 2, 454);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#3c7771');
      bg.addColorStop(1, '#163f42');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f2e6cd';
      ctx.textAlign = 'center';
      ctx.font = '800 45px "Yu Gothic", sans-serif';
      ctx.fillText('雨の日は', w / 2, 92);
      ctx.font = '800 62px "Yu Gothic", sans-serif';
      ctx.fillText('コーヒー', w / 2, 165);
      // big cup
      ctx.fillStyle = '#f1e4c7';
      fillRoundRect(ctx, 96, 250, 168, 125, 17, '#f1e4c7');
      ctx.strokeStyle = '#d5c39c';
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.arc(272, 304, 42, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.fillStyle = '#8f5e3c';
      ctx.beginPath();
      ctx.ellipse(180, 251, 84, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(244,237,216,0.55)';
      ctx.lineWidth = 8;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(140 + i * 39, 224);
        ctx.bezierCurveTo(118 + i * 39, 188, 168 + i * 39, 174, 146 + i * 39, 138);
        ctx.stroke();
      }
      ctx.fillStyle = '#f3e8ce';
      ctx.font = `700 23px "Yu Gothic", sans-serif`;
      ctx.fillText('HOT ¥120', w / 2, 432);
      ctx.font = `500 17px "Yu Gothic", sans-serif`;
      ctx.fillStyle = '#9ecdc3';
      ctx.fillText('レジにて お申し付けください', w / 2, 466);
    }
    ctx.textAlign = 'left';
  });
}

function makeInteriorClockTexture() {
  return makeClockTexture();
}

function addTexturedPanel(parent, texture, {
  w,
  h,
  x,
  y,
  z,
  ry = 0,
  toneMapped = false,
  opacity = 1,
} = {}) {
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: opacity < 1,
    opacity,
    toneMapped,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}

function addBoxTextured(parent, texture, {
  w,
  h,
  d,
  x,
  y,
  z,
  ry = 0,
  side = THREE.FrontSide,
} = {}) {
  const mat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  applyEdges(m, 35);
  return m;
}

/* ---------------------------------------------------------------- */
/*  products                                                         */
/* ---------------------------------------------------------------- */

const PRODUCT_COLORS = [
  '#e26450', '#e7ae4a', '#4eb297', '#4a8dbc', '#f2e7ce',
  '#b2709a', '#df8b58', '#83b95e', '#cb6f72', '#7065a0',
  '#e8c65c', '#69a9a2', '#d9e2db', '#aa7a56',
];

function createProductInstances(parent, items) {
  if (!items.length) return;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap: MAT.ink.gradientMap,
    emissive: 0x13110f,
    emissiveIntensity: 0.2,
  });
  const inst = new THREE.InstancedMesh(geo, mat, items.length);
  inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  items.forEach((it, i) => {
    dummy.position.set(it.x, it.y, it.z);
    dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    dummy.scale.set(it.w, it.h, it.d);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    inst.setColorAt(i, color.set(it.color));
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.castShadow = false;
  inst.receiveShadow = false;
  inst.frustumCulled = false;
  inst.name = 'product-instances';
  parent.add(inst);

  const labelItems = items.filter((it) => !it.noLabel);
  if (labelItems.length) {
    const lgeo = new THREE.BoxGeometry(1, 1, 1);
    const lmat = new THREE.MeshBasicMaterial({ color: 0xded5bf, toneMapped: true });
    const labels = new THREE.InstancedMesh(lgeo, lmat, labelItems.length);
    for (let i = 0; i < labelItems.length; i++) {
      const it = labelItems[i];
      const front = it.front || 1;
      dummy.position.set(
        it.x,
        it.y - it.h * 0.03,
        it.z + front * (it.d / 2 + 0.005),
      );
      dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      dummy.scale.set(it.w * 0.68, Math.max(it.h * 0.18, 0.022), 0.008);
      dummy.updateMatrix();
      labels.setMatrixAt(i, dummy.matrix);
    }
    labels.instanceMatrix.needsUpdate = true;
    labels.frustumCulled = false;
    parent.add(labels);
  }
}

function addGondola(store, cx, cz, items) {
  const w = 4.5;
  const d = 1.02;
  const y0 = FLOOR;
  const levels = [0.46, 0.81, 1.16, 1.5];
  const frameMat = toon('#d9cdb5');
  const trimMat = toon('#285b59');
  const shelfMat = toon('#efe3ca');

  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  store.add(g);

  // base plinth
  box(g, w, 0.2, d, trimMat, { y: y0 + 0.1, edge: true, edgeThreshold: 30 });
  // central body
  box(g, w - 0.1, 1.28, 0.76, toon('#d9ccb2'), {
    y: y0 + 0.76,
    edge: true,
    edgeThreshold: 35,
  });
  // outer uprights
  for (const sx of [-1, 1]) {
    box(g, 0.075, 1.62, d + 0.08, frameMat, {
      x: sx * (w / 2 - 0.035),
      y: y0 + 0.91,
      edge: true,
    });
  }
  // top cap
  box(g, w, 0.07, d + 0.08, trimMat, { y: y0 + 1.69, edge: true });
  // shelf boards
  levels.forEach((ly, idx) => {
    box(g, w - 0.16, 0.045, d + 0.05, shelfMat, {
      y: y0 + ly,
      edge: true,
      edgeThreshold: 40,
    });
    // green shelf lip
    box(g, w - 0.18, 0.055, 0.025, trimMat, {
      y: y0 + ly + 0.01,
      z: d / 2 + 0.012,
      edge: false,
    });
    box(g, w - 0.18, 0.055, 0.025, trimMat, {
      y: y0 + ly + 0.01,
      z: -d / 2 - 0.012,
      edge: false,
    });
    // cream price rails
    box(g, w - 0.25, 0.055, 0.012, toon('#efe6d1'), {
      y: y0 + ly + 0.055,
      z: d / 2 + 0.025,
      edge: false,
    });
    box(g, w - 0.25, 0.055, 0.012, toon('#efe6d1'), {
      y: y0 + ly + 0.055,
      z: -d / 2 - 0.025,
      edge: false,
    });
    for (let t = 0; t < 6; t++) {
      const tag = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.035, 0.01),
        new THREE.MeshBasicMaterial({ color: t % 3 === 0 ? 0xd75c45 : 0xd7c88f, toneMapped: true }),
      );
      tag.position.set(-1.85 + t * 0.72, y0 + ly + 0.058, d / 2 + 0.035);
      g.add(tag);
    }
  });

  // colourful product faces
  const shelfHeights = levels.map((l) => y0 + l + 0.026);
  for (let level = 0; level < levels.length; level++) {
    for (const side of [-1, 1]) {
      let x = -w / 2 + 0.22;
      const faceZ = side * (d / 2 + 0.09);
      while (x < w / 2 - 0.18) {
        if (rand() > 0.095) {
          const pw = randBetween(0.13, 0.26);
          const ph = randBetween(0.2, level === 3 ? 0.36 : 0.32);
          const pd = randBetween(0.09, 0.16);
          const color = pick(PRODUCT_COLORS);
          items.push({
            x: cx + x + pw / 2,
            y: shelfHeights[level] + ph / 2,
            z: cz + faceZ + side * pd / 2,
            w: pw,
            h: ph,
            d: pd,
            color,
            front: side,
            ry: (rand() - 0.5) * 0.05,
          });
          if (rand() > 0.77) {
            items.push({
              x: cx + x + pw / 2,
              y: shelfHeights[level] + ph + 0.055,
              z: cz + faceZ + side * (pd / 2 + 0.012),
              w: pw * 0.65,
              h: 0.09,
              d: 0.025,
              color: pick(['#f1e9d4', '#e8765f', '#e6bd58']),
              front: side,
              noLabel: true,
            });
          }
          x += pw + randBetween(0.035, 0.1);
        } else {
          x += 0.1;
        }
      }
    }
  }

  // end-cap goodies facing the main aisle
  const endX = cx + w / 2 - 0.06;
  for (let i = 0; i < 3; i++) {
    items.push({
      x: endX + 0.06,
      y: shelfHeights[i] + 0.14,
      z: cz + 0.12,
      w: 0.07,
      h: 0.26,
      d: 0.22,
      color: PRODUCT_COLORS[(i + 3) % PRODUCT_COLORS.length],
      front: 1,
      ry: Math.PI / 2,
    });
  }

  // little restock crates tucked under the first shelf
  box(g, 0.7, 0.28, 0.45, toon('#b88254'), {
    x: -1.55,
    y: y0 + 0.31,
    z: 0.04,
    edge: true,
  });
  box(g, 0.62, 0.22, 0.4, toon('#d1c4a7'), {
    x: 0.9,
    y: y0 + 0.3,
    z: 0.02,
    edge: true,
  });
}

/* ---------------------------------------------------------------- */
/*  store interior                                                   */
/* ---------------------------------------------------------------- */

function addCeiling(store) {
  const w = 9.55;
  const d = 12.0;
  const cx = -2.5;
  const cz = -4.35;
  const ceilingMat = toon('#f0e7d3', { emissive: 0x4a2c10, emissiveIntensity: 0.28 });
  box(store, w, 0.12, d, ceilingMat, {
    x: cx,
    y: CEIL + 0.07,
    z: cz,
    edge: true,
    edgeThreshold: 40,
    castShadow: false,
  });

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe0a6, toneMapped: false });
  const frameMat = toon('#d7c9ae');
  const xs = [-6.1, -3.7, -1.3, 1.05];
  const zs = [-2.4, -5.7, -8.65];
  for (const x of xs) {
    for (const z of zs) {
      box(store, 0.94, 0.04, 0.33, frameMat, {
        x,
        y: CEIL - 0.005,
        z,
        edge: false,
      });
      const p = plane(store, 0.83, 0.24, lightMat, {
        x,
        y: CEIL - 0.028,
        z,
        rx: Math.PI / 2,
      });
      p.renderOrder = 1;
    }
  }
  // hanging aisle sign fixtures
  const rodMat = toon('#4a5a58');
  for (const z of [-3.65, -6.1]) {
    for (const dx of [-0.75, 0.75]) {
      cylinder(store, 0.012, 0.012, 0.63, rodMat, {
        x: -4.55 + dx,
        y: CEIL - 0.33,
        z,
        edge: false,
        segments: 6,
      });
    }
  }
}

function addDrinkWall(store) {
  const g = new THREE.Group();
  store.add(g);
  const z = -10.16;
  const cx = -4.62;
  const w = 5.15;
  const h = 2.56;
  const cy = FLOOR + 0.12 + h / 2;
  const fridgeTex = makeFridgeTexture();
  const panelMat = new THREE.MeshBasicMaterial({ map: fridgeTex, toneMapped: false });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), panelMat);
  panel.position.set(cx, cy, z);
  g.add(panel);

  const frameMat = toon('#274f4e');
  box(g, w + 0.2, 0.16, 0.22, frameMat, { x: cx, y: cy + h / 2 + 0.06, z: z + 0.04, edge: true });
  box(g, w + 0.2, 0.24, 0.24, frameMat, { x: cx, y: cy - h / 2 - 0.1, z: z + 0.04, edge: true });
  for (const sx of [-1, 1]) {
    box(g, 0.16, h + 0.2, 0.23, frameMat, {
      x: cx + sx * (w / 2 + 0.08),
      y: cy,
      z: z + 0.04,
      edge: true,
    });
  }
  for (let i = 1; i < 4; i++) {
    const x = cx - w / 2 + (w / 4) * i;
    box(g, 0.055, h, 0.12, frameMat, { x, y: cy, z: z + 0.08, edge: false });
    // chunky door handles
    box(g, 0.035, 0.33, 0.05, toon('#c8d6d0'), {
      x: x + 0.07,
      y: cy + 0.05,
      z: z + 0.15,
      edge: false,
    });
  }
  // top header sign
  const headerTex = canvasTexture(512, 100, (ctx, ww, hh) => {
    ctx.fillStyle = '#234d4e';
    ctx.fillRect(0, 0, ww, hh);
    ctx.fillStyle = '#f7eccd';
    ctx.font = '700 40px "Trebuchet MS", sans-serif';
    ctx.fillText('COLD DRINKS', 22, 55);
    ctx.font = `700 28px "Yu Gothic", sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('つめた〜い 飲みもの', ww - 22, 56);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8b85d';
    ctx.fillRect(22, 76, ww - 44, 4);
  });
  addTexturedPanel(g, headerTex, { w: w, h: 0.24, x: cx, y: cy + h / 2 + 0.27, z: z + 0.2 });
  box(g, w + 0.1, 0.3, 0.1, toon('#18393a'), {
    x: cx,
    y: cy + h / 2 + 0.27,
    z: z + 0.13,
    edge: true,
  });
  // soft light bloom on the fridge face
  const glow = glowSprite(0xffe7b5, 3.3, 0.14, g);
  glow.position.set(cx, FLOOR + 1.7, z + 0.2);

  // a few real bottles in front of the textured display for parallax
  const bottleMats = [toon('#db5c50'), toon('#e1b75f'), toon('#4e9c88'), toon('#e9e1cf'), toon('#5b86b0')];
  for (let i = 0; i < 9; i++) {
    const x = cx - 2.2 + i * 0.48;
    const bottle = cylinder(g, 0.055, 0.067, 0.29, bottleMats[i % bottleMats.length], {
      x,
      y: FLOOR + 0.55 + (i % 2) * 0.35,
      z: z + 0.36,
      edge: false,
      segments: 8,
      castShadow: false,
    });
    bottle.rotation.z = (rand() - 0.5) * 0.02;
    cylinder(g, 0.034, 0.04, 0.07, bottleMats[i % bottleMats.length], {
      x,
      y: FLOOR + 0.73 + (i % 2) * 0.35,
      z: z + 0.36,
      edge: false,
      segments: 8,
      castShadow: false,
    });
  }
}

function addStaffDoor(store) {
  const g = new THREE.Group();
  store.add(g);
  const x = 0.72;
  const z = -10.18;
  const doorMat = toon('#a6b1ac');
  box(g, 1.15, 2.38, 0.08, doorMat, { x, y: FLOOR + 1.2, z, edge: true });
  box(g, 1.27, 0.13, 0.14, toon('#52645f'), { x, y: FLOOR + 2.42, z: z + 0.02, edge: true });
  box(g, 0.72, 0.38, 0.02, toon('#273f40'), {
    x,
    y: FLOOR + 1.78,
    z: z + 0.052,
    edge: false,
  });
  // tiny lit window
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xcfe0c5, toneMapped: false });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.22), windowMat);
  win.position.set(x, FLOOR + 1.78, z + 0.064);
  g.add(win);
  box(g, 0.035, 0.08, 0.04, toon('#d3b66e'), {
    x: x - 0.45,
    y: FLOOR + 1.08,
    z: z + 0.07,
    edge: false,
  });
  const label = canvasTexture(512, 110, (ctx, w, h) => {
    ctx.fillStyle = '#22393a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9d3bf';
    ctx.font = `600 31px "Yu Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('STAFF ONLY  /  関係者以外立入禁止', w / 2, 67);
    ctx.textAlign = 'left';
  });
  addTexturedPanel(g, label, { w: 1.1, h: 0.235, x, y: FLOOR + 2.6, z: z + 0.05 });
  // corridor light behind the door
  const glow = glowSprite(0xffdba2, 1.4, 0.16, g);
  glow.position.set(x, FLOOR + 2.1, z + 0.1);
}

function addMagazineRack(store) {
  const g = new THREE.Group();
  g.position.set(-5.55, FLOOR, 0.68);
  store.add(g);
  const frameMat = toon('#d4c8ad');
  const teal = toon('#2b5b58');
  // low display case facing the street
  box(g, 2.55, 0.7, 0.55, toon('#b89b73'), { y: 0.35, z: -0.02, edge: true });
  box(g, 2.56, 0.06, 0.64, frameMat, { y: 0.71, z: 0.04, edge: true });
  box(g, 2.5, 0.55, 0.05, teal, { y: 1.0, z: 0.28, edge: true });
  for (let row = 0; row < 3; row++) {
    const y = 0.79 + row * 0.28;
    box(g, 2.48, 0.035, 0.46, teal, {
      y: y - 0.03,
      z: 0.12 - row * 0.1,
      edge: false,
    });
    for (let i = 0; i < 7; i++) {
      const mag = makeMagazineTexture(row * 7 + i);
      const mat = new THREE.MeshBasicMaterial({ map: mag, toneMapped: true, side: THREE.DoubleSide });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), mat);
      p.position.set(-1.06 + i * 0.35, y + 0.19, 0.35 - row * 0.1);
      p.rotation.x = -0.22 - row * 0.04;
      g.add(p);
    }
  }
  // little hand-written POP
  const popTex = canvasTexture(360, 190, (ctx, w, h) => {
    ctx.fillStyle = '#f7efd9';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b85646';
    ctx.lineWidth = 5;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = '#b85646';
    ctx.font = `800 49px "Yu Gothic", sans-serif`;
    ctx.fillText('雨の日', 26, 78);
    ctx.fillStyle = '#305854';
    ctx.font = `700 27px "Yu Gothic", sans-serif`;
    ctx.fillText('は、読書とコーヒー。', 26, 123);
    ctx.fillStyle = '#a38b60';
    ctx.font = '500 18px "Trebuchet MS", sans-serif';
    ctx.fillText('MAGAZINE / NEW ISSUES', 26, 156);
  });
  const pop = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.35),
    new THREE.MeshBasicMaterial({ map: popTex, side: THREE.DoubleSide, toneMapped: true }),
  );
  pop.position.set(0.7, 0.97, 0.48);
  pop.rotation.z = -0.05;
  g.add(pop);
  const arm = cylinder(g, 0.012, 0.012, 0.3, teal, {
    x: 0.7,
    y: 1.12,
    z: 0.46,
    edge: false,
    segments: 6,
  });
  arm.rotation.z = 0.12;
}

function addATM(store) {
  const g = new THREE.Group();
  g.position.set(-6.95, FLOOR, -0.65);
  store.add(g);
  const bodyMat = toon('#d3d6ca');
  const trim = toon('#2d5f5d');
  box(g, 0.66, 1.52, 0.92, bodyMat, { y: 0.76, edge: true });
  box(g, 0.7, 0.15, 0.96, trim, { y: 1.48, edge: true });
  box(g, 0.7, 0.1, 0.96, trim, { y: 0.08, edge: true });
  // screen
  const screenTex = canvasTexture(360, 300, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1d586a');
    bg.addColorStop(1, '#173a47');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8ddc0';
    ctx.font = '700 26px "Trebuchet MS", sans-serif';
    ctx.fillText('HOSHIMI BANK', 24, 51);
    ctx.fillStyle = '#9be0d4';
    ctx.font = `600 33px "Yu Gothic", sans-serif`;
    ctx.fillText('お引き出し', 24, 126);
    ctx.fillStyle = 'rgba(230,244,235,0.72)';
    ctx.font = `500 20px "Yu Gothic", sans-serif`;
    ctx.fillText('カードを入れてください', 24, 178);
    ctx.fillStyle = '#2d7b74';
    fillRoundRect(ctx, 24, 216, w - 48, 49, 8, '#2d7b74');
    ctx.fillStyle = '#f1ebd7';
    ctx.font = '600 20px "Trebuchet MS", sans-serif';
    ctx.fillText('TOUCH TO START', 55, 247);
  });
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.38),
    new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
  );
  screen.position.set(0.338, 1.12, 0.06);
  screen.rotation.y = Math.PI / 2;
  g.add(screen);
  // keypad and card slot
  box(g, 0.025, 0.22, 0.3, toon('#455451'), { x: 0.34, y: 0.73, z: 0.05, edge: false });
  box(g, 0.02, 0.08, 0.03, new THREE.MeshBasicMaterial({ color: 0x78e2cf }), {
    x: 0.355,
    y: 1.39,
    z: 0.29,
    edge: false,
  });
  const glow = glowSprite(0x74d5d2, 0.95, 0.13, g);
  glow.position.set(0.45, 1.13, 0.05);
}

function addCheckout(store, state) {
  const g = new THREE.Group();
  store.add(g);
  const baseMat = toon('#d8cdb2');
  const teal = toon('#265b58');
  const counterTop = toon('#f0e5cf');
  const cx = 1.84;
  const cz = -3.2;
  const w = 0.88;
  const d = 3.35;
  // counter body
  box(g, w, 0.9, d, baseMat, { x: cx, y: FLOOR + 0.45, z: cz, edge: true });
  box(g, w + 0.07, 0.08, d + 0.08, counterTop, {
    x: cx,
    y: FLOOR + 0.94,
    z: cz,
    edge: true,
  });
  box(g, 0.02, 0.16, d - 0.16, teal, {
    x: cx - w / 2 - 0.011,
    y: FLOOR + 0.76,
    z: cz,
    edge: false,
  });
  // small customer shelf / bag hook
  box(g, 0.05, 0.25, 0.4, toon('#9b8b6e'), {
    x: cx - w / 2 - 0.035,
    y: FLOOR + 0.56,
    z: cz + 0.7,
    edge: true,
  });
  // register terminal
  const reg = new THREE.Group();
  reg.position.set(cx - 0.05, FLOOR + 0.98, cz + 0.71);
  g.add(reg);
  box(reg, 0.46, 0.1, 0.34, toon('#3f4b4d'), { y: 0.045, edge: true });
  box(reg, 0.3, 0.36, 0.25, toon('#2a3538'), { y: 0.27, edge: true });
  const pos = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.17),
    new THREE.MeshBasicMaterial({ map: makePosScreenTexture(), toneMapped: false, side: THREE.DoubleSide }),
  );
  pos.position.set(0.16, 0.3, 0);
  pos.rotation.y = Math.PI / 2;
  reg.add(pos);
  box(reg, 0.31, 0.02, 0.27, toon('#203035'), {
    y: 0.09,
    x: 0,
    z: 0.08,
    edge: false,
  });
  box(reg, 0.22, 0.035, 0.18, toon('#d3c9b5'), {
    y: 0.14,
    x: 0,
    z: -0.15,
    edge: false,
  });
  // customer-facing payment terminal
  const pay = new THREE.Group();
  pay.position.set(cx - 0.35, FLOOR + 0.99, cz - 0.97);
  g.add(pay);
  box(pay, 0.22, 0.05, 0.3, toon('#2e3c3f'), { y: 0.02, edge: true });
  box(pay, 0.18, 0.18, 0.05, toon('#243235'), { y: 0.14, rx: -0.32, edge: true });
  const payScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x96e2d0, toneMapped: false }),
  );
  payScreen.position.set(0, 0.16, -0.035);
  payScreen.rotation.x = -0.32;
  pay.add(payScreen);
  // small receipt printer
  box(g, 0.19, 0.16, 0.18, toon('#d9d2bf'), {
    x: cx + 0.2,
    y: FLOOR + 1.08,
    z: cz + 0.12,
    edge: true,
  });
  // card reader glow
  const payGlow = glowSprite(0x86e2d3, 0.55, 0.08, g);
  payGlow.position.set(cx - 0.35, FLOOR + 1.14, cz - 0.97);

  // oden warmer
  addOden(g, cx - 0.04, FLOOR + 1.01, cz - 1.05, state);
  // hot snack case
  addHotCase(g, cx - 0.05, FLOOR + 1.01, cz + 0.15);
  // stack of bags behind the counter
  box(g, 0.42, 0.24, 0.3, toon('#e4ddc8'), {
    x: cx + 0.12,
    y: FLOOR + 1.07,
    z: cz + 1.2,
    edge: true,
  });
  // small staff shelf against the wall
  box(g, 0.82, 0.08, 2.7, toon('#ccb996'), {
    x: 2.24,
    y: FLOOR + 1.2,
    z: -4.25,
    edge: true,
  });
  for (let i = 0; i < 4; i++) {
    box(g, 0.22, 0.22, 0.26, toon(['#d8c9ab', '#c2ae8e', '#e2d7be', '#b49772'][i]), {
      x: 2.23,
      y: FLOOR + 1.35,
      z: -3.4 - i * 0.5,
      edge: true,
    });
  }
  return g;
}

function addOden(parent, x, y, z, state) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const steel = toon('#9fa7a4');
  box(g, 0.64, 0.18, 0.42, steel, { y: 0.09, edge: true });
  const brothMat = new THREE.MeshBasicMaterial({ color: 0xd49142, toneMapped: true });
  const broth = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.35), brothMat);
  broth.rotation.x = -Math.PI / 2;
  broth.position.y = 0.185;
  g.add(broth);
  // compartments
  for (const xoff of [-0.195, -0.065, 0.065, 0.195]) {
    box(g, 0.008, 0.04, 0.33, steel, { x: xoff, y: 0.19, edge: false });
  }
  for (const zoff of [-0.08, 0.08]) {
    box(g, 0.58, 0.025, 0.006, steel, { y: 0.19, z: zoff, edge: false });
  }
  // oden items
  const itemColors = ['#b88343', '#e0b768', '#d0a15b', '#e6cf96', '#9b6d3e'];
  for (let i = 0; i < 9; i++) {
    const ix = -0.22 + (i % 3) * 0.2;
    const iz = -0.1 + Math.floor(i / 3) * 0.105;
    const item = sphere(g, 0.045 + (i % 2) * 0.014, toon(itemColors[i % itemColors.length]), {
      x: ix,
      y: 0.205,
      z: iz,
      segments: 10,
      rings: 7,
      edge: false,
      castShadow: false,
    });
    item.scale.y = 0.65;
    cylinder(g, 0.008, 0.008, 0.21, toon('#e5d8b8'), {
      x: ix + 0.02,
      y: 0.29,
      z: iz,
      edge: false,
      segments: 5,
      castShadow: false,
    });
  }
  // glass sneeze guard
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9f0ee,
    roughness: 0.06,
    metalness: 0.05,
    transparent: true,
    opacity: 0.26,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.31, 0.42), glassMat);
  lid.position.y = 0.34;
  g.add(lid);
  // amber glow just above soup
  const gl = glowSprite(0xffb45e, 0.55, 0.16, g);
  gl.position.set(0, 0.25, 0);
  state.steamOrigin = new THREE.Vector3(x, y + 0.42, z);
  return g;
}

function addHotCase(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const steel = toon('#9ba19e');
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffe7c6,
    transparent: true,
    opacity: 0.18,
    roughness: 0.05,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  box(g, 0.5, 0.08, 0.35, steel, { y: 0.04, edge: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.37, 0.35), glass);
  body.position.y = 0.245;
  g.add(body);
  box(g, 0.52, 0.03, 0.37, toon('#d1b173'), { y: 0.45, edge: true });
  for (let i = 0; i < 4; i++) {
    const food = sphere(g, 0.06, toon(['#c9873e', '#e3b356', '#bb6c3b', '#edca75'][i]), {
      x: -0.16 + i * 0.105,
      y: 0.11,
      z: 0.04,
      segments: 8,
      rings: 6,
      edge: false,
      castShadow: false,
    });
    food.scale.y = 0.55;
  }
  for (let i = 0; i < 4; i++) {
    box(g, 0.5, 0.012, 0.012, steel, { y: 0.24 + i * 0.001, z: -0.16 + i * 0.08, edge: false });
  }
  const warm = glowSprite(0xffb85b, 0.45, 0.16, g);
  warm.position.y = 0.27;
}

function addCoffeeStation(store) {
  const g = new THREE.Group();
  g.position.set(0, 0, 0);
  store.add(g);
  const x0 = 1.72;
  const x1 = 2.31;
  const z0 = -6.1;
  const z1 = -4.25;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  // cabinet
  box(g, x1 - x0, 0.9, z1 - z0, toon('#c9bda4'), {
    x: cx,
    y: FLOOR + 0.45,
    z: cz,
    edge: true,
  });
  box(g, x1 - x0 + 0.05, 0.07, z1 - z0 + 0.05, toon('#e9dcc3'), {
    x: cx,
    y: FLOOR + 0.92,
    z: cz,
    edge: true,
  });
  // coffee machine
  const mg = new THREE.Group();
  mg.position.set(1.98, FLOOR + 1.0, -5.0);
  g.add(mg);
  box(mg, 0.52, 0.72, 0.42, toon('#2c383a'), { y: 0.36, edge: true });
  box(mg, 0.48, 0.15, 0.02, toon('#1c282b'), { y: 0.51, z: 0.221, edge: false });
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x75ddc0, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.09), screenMat);
  screen.position.set(0.0, 0.58, 0.233);
  mg.add(screen);
  const cup = cylinder(mg, 0.055, 0.07, 0.09, toon('#e9e2d2'), {
    y: 0.14,
    z: 0.21,
    edge: false,
    segments: 10,
  });
  cup.rotation.x = 0.04;
  const coffee = cylinder(mg, 0.035, 0.04, 0.025, toon('#5a3a29'), {
    y: 0.19,
    z: 0.21,
    edge: false,
    segments: 10,
  });
  for (let i = 0; i < 3; i++) {
    cylinder(g, 0.05, 0.05, 0.08, toon('#e7e0ce'), {
      x: 1.94 + i * 0.1,
      y: FLOOR + 1.06,
      z: -5.45,
      edge: false,
      segments: 8,
      castShadow: false,
    });
  }
  // cup tower and stirrers
  const towerMat = toon('#f0e9d8');
  for (let i = 0; i < 5; i++) {
    cylinder(g, 0.048, 0.052, 0.026, towerMat, {
      x: 1.82,
      y: FLOOR + 1.05 + i * 0.027,
      z: -4.5,
      edge: false,
      segments: 10,
      castShadow: false,
    });
  }
  // small backlit menu strip
  const menuTex = canvasTexture(800, 180, (ctx, w, h) => {
    ctx.fillStyle = '#f4ead3';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3d625c';
    ctx.font = `700 35px "Yu Gothic", sans-serif`;
    ctx.fillText('COFFEE   ¥120', 25, 61);
    ctx.fillStyle = '#876342';
    ctx.font = `500 25px "Yu Gothic", sans-serif`;
    ctx.fillText('ホット / アイス　カフェラテ ¥150', 25, 105);
    ctx.fillStyle = '#d4a95d';
    ctx.fillRect(25, 135, w - 50, 3);
    ctx.fillStyle = '#55746f';
    ctx.font = '500 20px "Trebuchet MS", sans-serif';
    ctx.fillText('SELF SERVICE ・ HOSHIFURU MART', 25, 164);
  });
  addTexturedPanel(g, menuTex, {
    w: 0.9,
    h: 0.22,
    x: 1.91,
    y: FLOOR + 2.4,
    z: -5.05,
    ry: -Math.PI / 2,
  });
  // shelf above with cups
  box(g, 0.6, 0.06, 1.0, toon('#b5a889'), {
    x: 2.18,
    y: FLOOR + 1.7,
    z: -5.1,
    edge: true,
  });
  for (let i = 0; i < 3; i++) {
    cylinder(g, 0.05, 0.05, 0.08, towerMat, {
      x: 2.17,
      y: FLOOR + 1.77,
      z: -4.8 - i * 0.15,
      edge: false,
      segments: 8,
      castShadow: false,
    });
  }
  // warm under-shelf light
  box(g, 0.04, 0.02, 0.8, new THREE.MeshBasicMaterial({ color: 0xffdaa1, toneMapped: false }), {
    x: 1.84,
    y: FLOOR + 1.66,
    z: -5.1,
    edge: false,
  });
}

function addCigaretteDisplay(store) {
  const tex = makeCigaretteTexture();
  const frame = box(store, 0.08, 1.5, 1.4, toon('#243c3b'), {
    x: 2.35,
    y: FLOOR + 1.95,
    z: -2.72,
    edge: true,
  });
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.34, 1.4),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: true, side: THREE.DoubleSide }),
  );
  panel.position.set(2.304, FLOOR + 1.95, -2.72);
  panel.rotation.y = -Math.PI / 2;
  store.add(panel);
}

function addIceCreamFreezer(store) {
  const g = new THREE.Group();
  g.position.set(1.82, FLOOR, -8.15);
  store.add(g);
  box(g, 1.0, 0.7, 2.0, toon('#d9d3c1'), { y: 0.35, edge: true });
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.07, 1.9),
    new THREE.MeshBasicMaterial({ color: 0xc6f0f4, toneMapped: false, transparent: true, opacity: 0.56 }),
  );
  top.position.y = 0.73;
  g.add(top);
  box(g, 0.95, 0.06, 0.08, toon('#3d5f60'), {
    y: 0.81,
    z: 0.5,
    edge: false,
  });
  const label = canvasTexture(512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#294e52';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c8f4ef';
    ctx.font = '800 56px "Trebuchet MS", sans-serif';
    ctx.fillText('ICE CREAM', 22, 72);
    ctx.fillStyle = '#f0dcae';
    ctx.font = `700 28px "Yu Gothic", sans-serif`;
    ctx.fillText('つめたい おやつ', 24, 118);
  });
  const lab = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.28),
    new THREE.MeshBasicMaterial({ map: label, toneMapped: false, side: THREE.DoubleSide }),
  );
  lab.position.set(-0.51, 0.45, 0);
  lab.rotation.y = Math.PI / 2;
  g.add(lab);
  const gl = glowSprite(0xbcecff, 1.5, 0.1, g);
  gl.position.set(0, 0.8, 0);
}

function addBaskets(store) {
  const g = new THREE.Group();
  g.position.set(1.88, FLOOR, -0.28);
  store.add(g);
  for (let i = 0; i < 5; i++) {
    const b = box(g, 0.48, 0.11, 0.38, toon('#d9cdb3'), {
      y: 0.05 + i * 0.105,
      edge: true,
    });
    box(g, 0.36, 0.02, 0.05, toon('#816f55'), {
      x: 0,
      y: 0.11 + i * 0.105,
      z: 0.17,
      edge: false,
    });
  }
  const tag = canvasTexture(360, 130, (ctx, w, h) => {
    ctx.fillStyle = '#f2e7ce';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#345a56';
    ctx.font = `700 32px "Yu Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('買い物かご', w / 2, 56);
    ctx.font = '500 22px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#8a785b';
    ctx.fillText('SHOPPING BASKETS', w / 2, 94);
    ctx.textAlign = 'left';
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.21),
    new THREE.MeshBasicMaterial({ map: tag, side: THREE.DoubleSide, toneMapped: true }),
  );
  sign.position.set(0.15, 0.28, 0.2);
  g.add(sign);
}

function addEntranceRack(store) {
  // A slim magazine and newspaper rack right inside the corner glazing.
  // It gives the bright entrance pane something warm and human to look at.
  const g = new THREE.Group();
  g.position.set(1.9, FLOOR, 0.45);
  g.rotation.y = Math.PI / 2;
  store.add(g);

  const wood = toon('#9f7b53');
  const darkWood = toon('#4c3a2b');
  const frame = toon('#285451');

  box(g, 0.86, 0.06, 0.5, darkWood, { y: 0.03, edge: true });
  for (const x of [-0.4, 0.4]) {
    box(g, 0.06, 1.46, 0.5, wood, { x, y: 0.75, edge: true });
  }
  for (const y of [0.3, 0.62, 0.94, 1.26]) {
    box(g, 0.8, 0.035, 0.47, wood, { y, edge: true, castShadow: false });
  }
  box(g, 0.82, 1.46, 0.04, toon('#715639'), { y: 0.75, z: -0.24, edge: true });

  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 4; i++) {
      const cover = new THREE.Mesh(
        new THREE.PlaneGeometry(0.17, 0.25),
        new THREE.MeshBasicMaterial({ map: makeMagazineTexture(row * 4 + i), toneMapped: true }),
      );
      cover.position.set(-0.285 + i * 0.19, 0.44 + row * 0.32, 0.245);
      cover.rotation.x = -0.07;
      g.add(cover);
    }
  }

  // little glowing header and a warm shelf strip
  box(g, 0.84, 0.22, 0.07, frame, { y: 1.58, z: 0.16, edge: true });
  const header = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.17),
    new THREE.MeshBasicMaterial({ map: makeGondolaSignTexture('雑誌・新聞', 'MAGAZINES & NEWS', '#c8795b'), toneMapped: true }),
  );
  header.position.set(0, 1.58, 0.198);
  g.add(header);
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.022, 0.035),
    new THREE.MeshBasicMaterial({ color: 0xffe3ae, toneMapped: false }),
  );
  strip.position.set(0, 1.455, 0.235);
  g.add(strip);
  glowSprite(0xffcf8c, 1.15, 0.1, g).position.set(0, 1.4, 0.22);
}

function addWestWallDetails(store) {
  // posters and a quiet wall clock
  const posterTex = makePosterTexture('coffee');
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 1.15),
    new THREE.MeshBasicMaterial({ map: posterTex, toneMapped: true, side: THREE.DoubleSide }),
  );
  poster.position.set(-7.19, FLOOR + 1.84, -2.0);
  poster.rotation.y = Math.PI / 2;
  store.add(poster);
  box(store, 0.06, 1.23, 0.93, toon('#cbbd9f'), {
    x: -7.23,
    y: FLOOR + 1.84,
    z: -2.0,
    edge: true,
  });
  const clockTex = makeInteriorClockTexture();
  const clock = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.24),
    new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false }),
  );
  clock.position.set(-7.2, FLOOR + 2.9, -5.25);
  clock.rotation.y = Math.PI / 2;
  store.add(clock);
  box(store, 0.04, 0.3, 0.56, toon('#253d3e'), {
    x: -7.22,
    y: FLOOR + 2.9,
    z: -5.25,
    edge: true,
  });

  // locker / staff storage by the back wall
  const lock = new THREE.Group();
  lock.position.set(-6.95, FLOOR, -9.45);
  store.add(lock);
  box(lock, 0.68, 1.85, 0.92, toon('#aab1a8'), { y: 0.93, edge: true });
  for (let i = 0; i < 2; i++) {
    box(lock, 0.02, 0.72, 0.35, toon('#899690'), {
      x: 0.35,
      y: 0.72 + i * 0.8,
      z: 0.22,
      edge: true,
    });
    box(lock, 0.02, 0.02, 0.17, toon('#4d5d5b'), {
      x: 0.36,
      y: 0.8 + i * 0.8,
      z: 0.22,
      edge: false,
    });
  }
  // stacked stock boxes
  for (let i = 0; i < 3; i++) {
    box(store, 0.52, 0.26, 0.42, toon(['#b89468', '#cdb083', '#9d7a55'][i]), {
      x: -6.95,
      y: FLOOR + 1.98 + i * 0.27,
      z: -9.45,
      edge: true,
    });
  }
}

function addAisleSigns(store) {
  const labels = [
    { text: 'お菓子', sub: 'SNACKS & SWEETS', accent: '#d76c56', z: -3.7 },
    { text: '飲料', sub: 'DRINKS & ICE', accent: '#4c8d91', z: -6.15 },
  ];
  labels.forEach(({ text, sub, accent, z }, idx) => {
    const tex = makeGondolaSignTexture(text, sub, accent);
    const g = new THREE.Group();
    g.position.set(-4.55, 2.94, z);
    store.add(g);
    for (const x of [-0.8, 0.8]) {
      cylinder(g, 0.01, 0.01, 0.56, toon('#7d877d'), {
        x,
        y: 0.5,
        edge: false,
        segments: 5,
      });
    }
    box(g, 1.76, 0.46, 0.07, toon('#e6d9bf'), { y: 0, edge: true });
    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(1.68, 0.4),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: true }),
    );
    front.position.set(0, 0, 0.041);
    g.add(front);
    const back = front.clone();
    back.position.z = -0.041;
    back.rotation.y = Math.PI;
    g.add(back);
  });

  // hanging new-arrival flag closer to the entrance
  const bannerTex = makeSaleBannerTexture('新発売', 'NEW ARRIVAL', '#dd6b55');
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 1.25),
    new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide, toneMapped: true }),
  );
  banner.position.set(-2.05, 2.16, 0.25);
  banner.rotation.y = 0.1;
  store.add(banner);
  cylinder(store, 0.008, 0.008, 0.94, toon('#59625d'), {
    x: -2.05,
    y: 3.25,
    z: 0.25,
    edge: false,
    segments: 4,
  });
}

function addInteriorPosters(store) {
  const promoOden = makeInteriorPromoTexture('oden');
  const posterOden = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 1.12),
    new THREE.MeshBasicMaterial({ map: promoOden, side: THREE.DoubleSide, toneMapped: true }),
  );
  posterOden.position.set(-2.0, FLOOR + 2.27, -10.14);
  store.add(posterOden);
  box(store, 0.92, 1.25, 0.05, toon('#cbbfa4'), {
    x: -2.0,
    y: FLOOR + 2.27,
    z: -10.17,
    edge: true,
  });
  const promoCoffee = makeInteriorPromoTexture('coffee');
  const posterCoffee = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 1.25),
    new THREE.MeshBasicMaterial({ map: promoCoffee, side: THREE.DoubleSide, toneMapped: true }),
  );
  posterCoffee.position.set(2.304, FLOOR + 2.18, -8.55);
  posterCoffee.rotation.y = -Math.PI / 2;
  store.add(posterCoffee);
  box(store, 0.05, 1.38, 1.02, toon('#c4b696'), {
    x: 2.32,
    y: FLOOR + 2.18,
    z: -8.55,
    edge: true,
  });
  // backlit poster near the entrance window
  const backlit = new THREE.Group();
  backlit.position.set(-6.9, FLOOR + 2.2, 1.45);
  store.add(backlit);
  const frameMat = toon('#d7c9ad');
  box(backlit, 1.0, 1.45, 0.08, frameMat, { edge: true });
  const pic = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 1.35),
    new THREE.MeshBasicMaterial({ map: promoCoffee, toneMapped: false }),
  );
  pic.position.z = 0.045;
  backlit.add(pic);
  const gl = glowSprite(0xffdfae, 1.2, 0.08, backlit);
  gl.position.z = 0.1;
}

function addFrontDisplay(store, items) {
  const g = new THREE.Group();
  g.position.set(-2.92, FLOOR, 0.82);
  store.add(g);
  box(g, 1.25, 0.68, 0.55, toon('#cfbf9e'), { y: 0.34, edge: true });
  box(g, 1.3, 0.06, 0.62, toon('#e4d7bc'), { y: 0.7, edge: true });
  const boxMat = toon('#ae8a5d');
  for (let i = 0; i < 4; i++) {
    box(g, 0.25, 0.22, 0.32, boxMat, {
      x: -0.43 + i * 0.29,
      y: 0.84,
      edge: true,
    });
    // small seasonal label flags
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.09),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xe7b65d : 0xcf6e5b, side: THREE.DoubleSide }),
    );
    flag.position.set(-0.43 + i * 0.29, 1.0, 0.17);
    g.add(flag);
  }
  // a couple of large bags
  for (let i = 0; i < 5; i++) {
    items.push({
      x: -3.35 + i * 0.2,
      y: FLOOR + 1.15,
      z: 0.98,
      w: 0.16,
      h: 0.26,
      d: 0.1,
      color: PRODUCT_COLORS[(i + 5) % PRODUCT_COLORS.length],
      front: 1,
      ry: randBetween(-0.08, 0.08),
    });
  }
  // onigiri warmer / hero rice balls on the front counter
  const warmer = new THREE.Group();
  warmer.position.set(0.8, 0.73, 0.16);
  g.add(warmer);
  box(warmer, 0.5, 0.24, 0.36, toon('#586462'), { y: 0.12, edge: true });
  const lidMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2e3c3,
    transparent: true,
    opacity: 0.25,
    roughness: 0.1,
    metalness: 0.1,
  });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.34), lidMat);
  lid.position.y = 0.24;
  warmer.add(lid);
  for (let i = 0; i < 4; i++) {
    const oni = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.09, 3), toon('#f1e7d1'), {
      parent: warmer,
      x: -0.16 + i * 0.11,
      y: 0.11,
      z: 0,
      rx: Math.PI / 2,
      rz: Math.PI / 6,
      edge: true,
      castShadow: false,
    });
    box(warmer, 0.075, 0.08, 0.004, toon('#223634'), {
      x: -0.16 + i * 0.11,
      y: 0.11,
      z: 0.065,
      edge: false,
      castShadow: false,
    });
  }
  // little price stand
  box(g, 0.36, 0.22, 0.04, toon('#f0e6cf'), {
    x: 0.1,
    y: 0.73,
    z: 0.37,
    rx: -0.25,
    edge: true,
  });
}

function addPromoIsland(store) {
  // A small seasonal display in the middle of the shop, catching the
  // eye through the entrance glass without blocking the walkway.
  const g = new THREE.Group();
  g.position.set(-1.35, FLOOR, -1.65);
  store.add(g);

  const baseMat = toon('#d8c8a9');
  const trimMat = toon('#2b5c58');
  box(g, 1.18, 0.72, 0.64, baseMat, { y: 0.36, edge: true, castShadow: false });
  box(g, 1.22, 0.07, 0.68, toon('#eadcc1'), { y: 0.735, edge: true, castShadow: false });
  box(g, 1.12, 0.08, 0.02, trimMat, { y: 0.55, z: 0.33, edge: false, castShadow: false });

  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 4; i++) {
      const color = PRODUCT_COLORS[(row * 4 + i + 2) % PRODUCT_COLORS.length];
      box(g, 0.2, 0.2, 0.14, toon(color), {
        x: -0.39 + i * 0.26,
        y: 0.88 + row * 0.23,
        z: 0.08,
        edge: true,
        castShadow: false,
      });
      box(g, 0.12, 0.025, 0.004, toon('#f2e6c9'), {
        x: -0.39 + i * 0.26,
        y: 0.84 + row * 0.23,
        z: 0.153,
        edge: false,
        castShadow: false,
      });
    }
  }

  // little easel sign with a hand-written price
  const signTex = canvasTexture(300, 360, (ctx, w, h) => {
    ctx.fillStyle = '#f4e7ca';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b65b48';
    ctx.lineWidth = 9;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.fillStyle = '#2c5551';
    ctx.font = `700 54px "Yu Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('おすすめ', w / 2, 96);
    ctx.fillStyle = '#c3624f';
    ctx.font = '800 64px "Trebuchet MS", sans-serif';
    ctx.fillText('¥ 198', w / 2, 188);
    ctx.fillStyle = '#6e7c6d';
    ctx.font = '500 22px "Trebuchet MS", sans-serif';
    ctx.fillText('NEW SEASON', w / 2, 235);
    ctx.fillStyle = '#b9a26b';
    ctx.fillRect(36, 268, w - 72, 3);
    ctx.fillStyle = '#3d5c56';
    ctx.font = `600 22px "Yu Gothic", sans-serif`;
    ctx.fillText('星見町店', w / 2, 310);
    ctx.textAlign = 'left';
  });
  const easel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.5),
    new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, toneMapped: true }),
  );
  easel.position.set(0.02, 1.15, 0.22);
  easel.rotation.x = -0.12;
  g.add(easel);
  const easelBack = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.54),
    toon('#a78a64'),
  );
  easelBack.position.set(0.02, 1.15, 0.208);
  easelBack.rotation.x = -0.12;
  g.add(easelBack);
  box(g, 0.46, 0.025, 0.16, toon('#8f7453'), {
    x: 0.02,
    y: 0.9,
    z: 0.16,
    rx: -0.12,
    edge: true,
    castShadow: false,
  });
}

function addFloorGuides(store) {
  const arrowTex = makeFloorArrowTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: arrowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.77,
    toneMapped: true,
    side: THREE.DoubleSide,
  });
  const makeArrow = (x, z, rot = 0, scale = 1) => {
    const geo = new THREE.PlaneGeometry(0.42, 0.84);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, FLOOR + 0.006, z);
    m.rotation.y = rot;
    m.scale.setScalar(scale);
    m.renderOrder = 3;
    store.add(m);
  };
  makeArrow(0.5, 0.15, Math.PI, 0.85);
  makeArrow(0.35, -0.85, 0, 0.65);
  const tapeMat = new THREE.MeshBasicMaterial({ color: 0xb9a469, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 4; i++) {
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.05), tapeMat);
    tape.rotation.x = -Math.PI / 2;
    tape.position.set(0.45, FLOOR + 0.004, -1.05 - i * 0.28);
    store.add(tape);
  }
}

/* ---------------------------------------------------------------- */
/*  exterior                                                         */
/* ---------------------------------------------------------------- */

function addGlazing(store, state, fx) {
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbddeeb,
    roughness: 0.06,
    metalness: 0.12,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.1,
  });
  const doorGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9e5ee,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.2,
  });
  const rainTex = makeGlassRainTexture();
  const sheenTex = makeGlassSheenTexture();
  const rainMats = [];

  const makeRainOverlay = (w, h, parent, x, y, z, ry = 0, mat = null) => {
    const m = new THREE.MeshBasicMaterial({
      map: rainTex,
      transparent: true,
      opacity: 0.44,
      color: 0xbfe8f4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    rainMats.push(m);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat ?? m);
    p.position.set(x, y, z);
    p.rotation.y = ry;
    p.renderOrder = 8;
    parent.add(p);
    return p;
  };

  const makeSheen = (w, h, parent, x, y, z, ry = 0, opacity = 1) => {
    const m = new THREE.MeshBasicMaterial({
      map: sheenTex,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
      color: 0xb8d9e8,
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y, z);
    p.rotation.y = ry;
    p.renderOrder = 7;
    parent.add(p);
  };

  // south fixed panes
  const sillTop = 0.46;
  const glassTop = 3.48;
  const gh = glassTop - sillTop;
  const panes = [
    [-7.28, -4.94],
    [-4.86, -2.54],
    [-2.46, -0.54],
    [1.53, 2.38],
  ];
  for (const [a, b] of panes) {
    const w = b - a;
    const x = (a + b) / 2;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, gh), glassMat);
    pane.position.set(x, sillTop + gh / 2, glassZ + 0.008);
    pane.renderOrder = 2;
    store.add(pane);
    makeSheen(w, gh, store, x, sillTop + gh / 2, glassZ + 0.018, 0, 0.2);
    if (w > 2.0) makeRainOverlay(w, gh, store, x, sillTop + gh / 2, glassZ + 0.024);
    // transom line
    box(store, w, 0.035, 0.05, toon('#274c4d'), {
      x,
      y: 2.7,
      z: glassZ + 0.05,
      edge: false,
      castShadow: false,
    });
  }
  // optional poster inside the left window
  const posterTex = makePosterTexture('onigiri');
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 1.0),
    new THREE.MeshBasicMaterial({ map: posterTex, side: THREE.DoubleSide, toneMapped: true }),
  );
  poster.position.set(-3.6, 1.45, glassZ + 0.028);
  store.add(poster);
  const posterFrame = box(store, 0.8, 1.08, 0.02, toon('#d9c9aa'), {
    x: -3.6,
    y: 1.45,
    z: glassZ + 0.018,
    edge: true,
    castShadow: false,
  });

  // Part-time staff poster on the right fixed pane.
  const staffTex = canvasTexture(360, 480, (ctx, w, h) => {
    ctx.fillStyle = '#f6ecd3';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#205a58';
    ctx.fillRect(0, 0, w, 92);
    ctx.fillStyle = '#fff3d1';
    ctx.textAlign = 'center';
    ctx.font = `700 33px "Yu Gothic", sans-serif`;
    ctx.fillText('スタッフ募集', w / 2, 60);
    ctx.fillStyle = '#c45f4d';
    ctx.font = '900 54px "Trebuchet MS", sans-serif';
    ctx.fillText('STAFF', w / 2, 156);
    ctx.fillText('WANTED', w / 2, 208);
    ctx.fillStyle = '#2c5551';
    ctx.font = `700 26px "Yu Gothic", sans-serif`;
    ctx.fillText('時給 1,200円〜', w / 2, 268);
    ctx.fillStyle = '#7b735d';
    ctx.font = `500 19px "Yu Gothic", sans-serif`;
    ctx.fillText('深夜は 1,500円', w / 2, 302);
    ctx.fillStyle = '#b9a26b';
    ctx.fillRect(40, 330, w - 80, 2);
    ctx.fillStyle = '#315b55';
    ctx.font = `600 21px "Yu Gothic", sans-serif`;
    ctx.fillText('星降るマート 星見町店', w / 2, 380);
    ctx.fillStyle = '#8c7a5b';
    ctx.font = '500 16px "Trebuchet MS", sans-serif';
    ctx.fillText('ASK AT THE COUNTER', w / 2, 422);
    ctx.textAlign = 'left';
  });
  const staffPoster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.66),
    new THREE.MeshBasicMaterial({ map: staffTex, toneMapped: true }),
  );
  staffPoster.position.set(1.95, 1.72, glassZ + 0.028);
  store.add(staffPoster);
  box(store, 0.58, 0.74, 0.02, toon('#d9c9aa'), {
    x: 1.95,
    y: 1.72,
    z: glassZ + 0.018,
    edge: true,
    castShadow: false,
  });

  // east fixed panes
  const eastFrame = 2.5;
  const eastPanes = [
    [-10.24, -7.68],
    [-7.58, -5.04],
    [-4.94, -2.44],
    [-2.34, 0.16],
    [0.3, 1.62],
  ];
  for (const [a, b] of eastPanes) {
    const w = b - a;
    const z = (a + b) / 2;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, gh), glassMat);
    pane.position.set(eastFrame + 0.018, sillTop + gh / 2, z);
    pane.rotation.y = Math.PI / 2;
    pane.renderOrder = 2;
    store.add(pane);
    makeSheen(w, gh, store, eastFrame + 0.03, sillTop + gh / 2, z, Math.PI / 2, 0.14);
    if (w > 1.8) makeRainOverlay(w, gh, store, eastFrame + 0.036, sillTop + gh / 2, z, Math.PI / 2);
  }
  // pale frosted band at the bottom of the glass
  const frostMat = new THREE.MeshBasicMaterial({ color: 0xc9e2e4, transparent: true, opacity: 0.08 });
  for (const [a, b] of panes) {
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 0.23), frostMat);
    fm.position.set((a + b) / 2, 0.61, glassZ + 0.026);
    store.add(fm);
  }

  // sliding automatic doors
  const doorBaseY = 0.5;
  const doorH = 2.94;
  const doorZ = glassZ + 0.065;
  const leftBase = -0.015;
  const rightBase = 0.985;
  const makeDoor = (baseX, handleSide) => {
    const g = new THREE.Group();
    g.position.set(baseX, 0, doorZ);
    store.add(g);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.94, doorH), doorGlassMat);
    glass.position.y = doorBaseY + doorH / 2;
    glass.renderOrder = 2;
    g.add(glass);
    box(g, 0.06, doorH + 0.08, 0.08, toon('#254a4c'), { x: -0.47, y: doorBaseY + doorH / 2, edge: true });
    box(g, 0.06, doorH + 0.08, 0.08, toon('#254a4c'), { x: 0.47, y: doorBaseY + doorH / 2, edge: true });
    box(g, 0.96, 0.07, 0.08, toon('#254a4c'), { y: doorBaseY + doorH + 0.02, edge: true });
    box(g, 0.96, 0.13, 0.08, toon('#254a4c'), { y: doorBaseY + 0.068, edge: true });
    // handle
    box(g, 0.026, 0.54, 0.035, toon('#c6d8d3'), {
      x: handleSide * 0.38,
      y: doorBaseY + 1.62,
      z: 0.07,
      edge: false,
    });
    makeRainOverlay(0.9, doorH, g, 0, doorBaseY + doorH / 2, 0.075, 0, null);
    makeSheen(0.94, doorH, g, 0, doorBaseY + doorH / 2, 0.085, 0, 0.16);
    return g;
  };
  const leftDoor = makeDoor(leftBase, 1);
  const rightDoor = makeDoor(rightBase, -1);
  leftDoor.userData.closedX = leftBase;
  rightDoor.userData.closedX = rightBase;
  state.leftDoor = leftDoor;
  state.rightDoor = rightDoor;

  // door frame posts and track
  for (const x of [-0.54, 1.49]) {
    box(store, 0.11, 3.6, 0.2, toon('#234648'), {
      x,
      y: 0.16 + 1.8,
      z: glassZ + 0.04,
      edge: true,
    });
  }
  box(store, 2.12, 0.16, 0.23, toon('#1c3e40'), {
    x: 0.48,
    y: 3.53,
    z: glassZ + 0.07,
    edge: true,
  });
  box(store, 2.0, 0.09, 0.38, toon('#445654'), {
    x: 0.48,
    y: 0.27,
    z: glassZ + 0.1,
    edge: true,
    castShadow: false,
  });
  // door sensor with tiny LED
  box(store, 0.28, 0.12, 0.14, toon('#202d30'), {
    x: 0.48,
    y: 3.4,
    z: 2.03,
    edge: true,
    castShadow: false,
  });
  const sensorMat = new THREE.MeshBasicMaterial({ color: 0x75e0bf, toneMapped: false });
  const sensor = sphere(store, 0.027, sensorMat, {
    x: 0.48,
    y: 3.37,
    z: 2.107,
    segments: 8,
    rings: 6,
    edge: false,
    castShadow: false,
  });
  state.sensorMat = sensorMat;

  // small window stickers on the fixed glass
  const stickerTex = makeOpenSignTexture();
  const sticker = new THREE.Mesh(
    new THREE.PlaneGeometry(0.67, 0.24),
    new THREE.MeshBasicMaterial({ map: stickerTex, transparent: true, toneMapped: false, side: THREE.DoubleSide }),
  );
  sticker.position.set(1.85, 2.6, glassZ + 0.04);
  store.add(sticker);

  state.rainMats = rainMats;
  state.rainTex = rainTex;
}

function addSigns(store, state) {
  // fascia sign south
  const signBg = toon('#214d4b');
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe1a1, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false });
  const southTexture = makeStoreSignTexture('south');
  const southMat = new THREE.MeshBasicMaterial({ map: southTexture, toneMapped: false });
  box(store, 9.65, 1.58, 0.16, signBg, {
    x: -2.5,
    y: 4.62,
    z: 1.93,
    edge: true,
    castShadow: true,
  });
  const southSign = new THREE.Mesh(new THREE.PlaneGeometry(9.46, 1.34), southMat);
  southSign.position.set(-2.5, 4.62, 2.018);
  store.add(southSign);
  const southGlow = glowSprite(0xffdfa0, 6.2, 0.12, store);
  southGlow.position.set(-2.5, 4.66, 2.2);
  state.southSignMat = southMat;
  state.southGlow = southGlow;

  // fascia sign east
  const eastTexture = makeStoreSignTexture('east');
  const eastMat = new THREE.MeshBasicMaterial({ map: eastTexture, toneMapped: false });
  box(store, 0.16, 1.4, 6.9, signBg, {
    x: 2.63,
    y: 4.58,
    z: -4.15,
    edge: true,
  });
  const eastSign = new THREE.Mesh(new THREE.PlaneGeometry(6.65, 1.2), eastMat);
  eastSign.position.set(2.72, 4.58, -4.15);
  eastSign.rotation.y = Math.PI / 2;
  store.add(eastSign);
  const eastGlow = glowSprite(0xffdfa0, 4.1, 0.09, store);
  eastGlow.position.set(2.9, 4.6, -4.15);
  state.eastSignMat = eastMat;
  state.eastGlow = eastGlow;

  // vertical 24H blade sign on the corner
  const verticalTex = makeVerticalSignTexture();
  const verticalMat = new THREE.MeshBasicMaterial({ map: verticalTex, toneMapped: false });
  box(store, 0.1, 2.1, 0.62, toon('#1a4142'), {
    x: 2.8,
    y: 4.22,
    z: 1.45,
    edge: true,
  });
  const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.98), verticalMat);
  blade.position.set(2.86, 4.22, 1.45);
  blade.rotation.y = Math.PI / 2;
  store.add(blade);
  const bladeSouth = blade.clone();
  bladeSouth.position.set(2.8, 4.22, 1.761);
  bladeSouth.rotation.y = 0;
  store.add(bladeSouth);
  state.verticalSignMat = verticalMat;
  state.bladeSign = blade;
  const bladeGlow = glowSprite(0xffd894, 1.8, 0.14, store);
  bladeGlow.position.set(2.96, 4.23, 1.75);
  state.bladeGlow = bladeGlow;

  // thin colorful fascia stripe under canopy
  const stripeColors = [0xe8c26d, 0x73b9a6, 0xd86a54];
  for (let i = 0; i < 3; i++) {
    box(store, 9.35, 0.06, 0.04, toon(stripeColors[i]), {
      x: -2.5,
      y: 3.86 - i * 0.065,
      z: 2.06,
      edge: false,
      castShadow: false,
    });
  }
}

function addCanopy(store, state) {
  const canopyMat = toon('#e6ddc9');
  const trim = toon('#214b4a');
  // south canopy
  box(store, 10.35, 0.16, 2.05, canopyMat, {
    x: -2.5,
    y: 3.77,
    z: 2.82,
    edge: true,
    edgeThreshold: 32,
    castShadow: true,
  });
  box(store, 10.4, 0.24, 0.12, trim, {
    x: -2.5,
    y: 3.69,
    z: 3.83,
    edge: true,
    castShadow: true,
  });
  box(store, 10.4, 0.1, 0.08, toon('#e4c47d'), {
    x: -2.5,
    y: 3.58,
    z: 3.78,
    edge: false,
  });
  // east canopy
  box(store, 1.55, 0.16, 12.45, canopyMat, {
    x: 3.22,
    y: 3.77,
    z: -4.35,
    edge: true,
    edgeThreshold: 32,
    castShadow: true,
  });
  box(store, 0.12, 0.24, 12.5, trim, {
    x: 3.98,
    y: 3.69,
    z: -4.35,
    edge: true,
    castShadow: true,
  });
  box(store, 0.08, 0.1, 12.5, toon('#e4c47d'), {
    x: 3.93,
    y: 3.58,
    z: -4.35,
    edge: false,
  });
  // underside light strips
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe8b8, toneMapped: false });
  box(store, 4.3, 0.035, 0.12, lightMat, {
    x: -1.0,
    y: 3.67,
    z: 2.16,
    edge: false,
    castShadow: false,
  });
  box(store, 0.12, 0.035, 3.3, lightMat, {
    x: 3.72,
    y: 3.67,
    z: -2.2,
    edge: false,
    castShadow: false,
  });
  for (let i = 0; i < 5; i++) {
    cylinder(store, 0.07, 0.07, 0.018, lightMat, {
      x: -6.1 + i * 1.7,
      y: 3.67,
      z: 2.85,
      edge: false,
      segments: 12,
      castShadow: false,
    });
  }
  const underGlow = glowSprite(0xffd58c, 5.0, 0.12, store);
  underGlow.position.set(-1.2, 3.45, 3.2);
  // vertical sign support bar
  box(store, 0.08, 0.7, 0.08, trim, {
    x: 2.9,
    y: 3.15,
    z: 1.6,
    edge: true,
    castShadow: false,
  });

  // entry doormat
  const matTex = makeDoormatTexture();
  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(2.05, 0.92),
    new THREE.MeshStandardMaterial({
      map: matTex,
      roughness: 0.48,
      metalness: 0.03,
      color: 0xb8c2b3,
    }),
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(0.48, 0.171, 2.58);
  mat.receiveShadow = true;
  store.add(mat);

  // matching mat just inside the sliding doors, so the entrance has depth
  const innerMat = new THREE.Mesh(
    new THREE.PlaneGeometry(1.72, 0.78),
    new THREE.MeshStandardMaterial({
      map: matTex,
      roughness: 0.58,
      metalness: 0.02,
      color: 0xa9b9a8,
    }),
  );
  innerMat.rotation.x = -Math.PI / 2;
  innerMat.position.set(0.48, FLOOR + 0.008, 0.62);
  innerMat.receiveShadow = true;
  store.add(innerMat);
  // shallow entrance step
  box(store, 2.35, 0.068, 0.45, toon('#7c8684'), {
    x: 0.48,
    y: 0.2,
    z: 2.09,
    edge: true,
    castShadow: true,
  });

  // warm light spilling through the open door
  const doorSpill = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, 2.4),
    new THREE.MeshBasicMaterial({
      map: getGlowTexture(),
      color: 0xffca7d,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const geo = doorSpill.geometry;
  geo.rotateX(-Math.PI / 2);
  doorSpill.position.set(0.48, 0.18, 2.82);
  doorSpill.renderOrder = 6;
  store.add(doorSpill);
  state.doorSpill = doorSpill;

  // gutter downspout at the corner
  cylinder(store, 0.055, 0.055, 4.0, toon('#4f5b5a'), {
    x: -7.34,
    y: 2.0,
    z: 2.02,
    edge: true,
    segments: 10,
    castShadow: false,
  });
  const elbow = cylinder(store, 0.055, 0.06, 0.35, toon('#4f5b5a'), {
    x: -7.34,
    y: 0.18,
    z: 2.14,
    edge: true,
    segments: 10,
    castShadow: false,
  });
  elbow.rotation.x = 0.7;

  // wall camera
  box(store, 0.16, 0.14, 0.28, toon('#2b393b'), {
    x: -6.8,
    y: 3.3,
    z: 2.16,
    edge: true,
    castShadow: false,
  });
  const lens = cylinder(store, 0.035, 0.035, 0.05, toon('#0d1618'), {
    x: -6.8,
    y: 3.28,
    z: 2.32,
    rx: Math.PI / 2,
    edge: false,
    segments: 10,
    castShadow: false,
  });
}

function addExteriorAC(store, state) {
  const g = new THREE.Group();
  g.position.set(2.69, 2.16, -8.55);
  store.add(g);
  const body = box(g, 0.42, 0.68, 0.94, toon('#d9d4c4'), { edge: true });
  // front grille faces east
  const grille = new THREE.Group();
  grille.position.set(0.22, -0.02, 0);
  g.add(grille);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 6, 24), toon('#8e9891'));
  ring.rotation.y = Math.PI / 2;
  ring.position.x = 0.23;
  g.add(ring);
  const fan = new THREE.Group();
  fan.position.set(0.24, 0, 0);
  g.add(fan);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.035, 0.2),
      new THREE.MeshToonMaterial({ color: 0x7b8581 }),
    );
    blade.position.z = 0;
    blade.rotation.x = (i * Math.PI * 2) / 3;
    blade.position.y = Math.sin(i * 2.1) * 0.09;
    blade.position.z = Math.cos(i * 2.1) * 0.09;
    fan.add(blade);
  }
  state.fan = fan;
  // grille slats
  for (let i = 0; i < 5; i++) {
    box(g, 0.03, 0.02, 0.7, toon('#525f5c'), {
      x: 0.235,
      y: -0.2 + i * 0.1,
      z: 0,
      edge: false,
      castShadow: false,
    });
  }
  // condensation drip pipe
  cylinder(store, 0.018, 0.018, 1.8, toon('#59645f'), {
    x: 2.9,
    y: 1.15,
    z: -8.16,
    edge: false,
    segments: 6,
    castShadow: false,
  });
  // mounting brackets
  for (const z of [-0.28, 0.28]) {
    box(store, 0.2, 0.05, 0.05, toon('#465351'), {
      x: 2.49,
      y: 1.93,
      z: -8.55 + z,
      edge: true,
      castShadow: false,
    });
  }
}

function addRooftop(store) {
  const g = new THREE.Group();
  store.add(g);
  const slab = toon('#b0b6a9');
  // roof deck
  box(g, 10.25, 0.2, 12.55, slab, {
    x: -2.5,
    y: 5.55,
    z: -4.35,
    edge: true,
    castShadow: true,
  });
  const parapet = toon('#e3dcc9');
  const trim = toon('#2d4d4c');
  for (const edge of [
    [10.45, 0.4, 0.16, -2.5, 5.65, 1.98],
    [10.45, 0.4, 0.16, -2.5, 5.65, -10.68],
    [0.16, 0.4, 12.7, -7.62, 5.65, -4.35],
    [0.16, 0.4, 12.7, 2.62, 5.65, -4.35],
  ]) {
    box(g, edge[0], edge[1], edge[2], parapet, {
      x: edge[3],
      y: edge[4],
      z: edge[5],
      edge: true,
    });
  }
  box(g, 10.5, 0.09, 0.22, trim, {
    x: -2.5,
    y: 5.79,
    z: 1.96,
    edge: true,
  });
  // roof access hatch and a squat vent near the front parapet
  box(g, 0.9, 0.16, 0.72, toon('#8c9892'), {
    x: 0.95,
    y: 5.73,
    z: -2.3,
    edge: true,
    castShadow: true,
  });
  box(g, 0.98, 0.04, 0.8, toon('#6a7771'), {
    x: 0.95,
    y: 5.82,
    z: -2.3,
    edge: true,
    castShadow: false,
  });
  cylinder(g, 0.14, 0.17, 0.46, toon('#7f8b84'), {
    x: -1.7,
    y: 5.88,
    z: -1.9,
    edge: true,
    segments: 12,
    castShadow: true,
  });
  cylinder(g, 0.24, 0.17, 0.09, toon('#5e6b65'), {
    x: -1.7,
    y: 6.14,
    z: -1.9,
    edge: true,
    segments: 12,
    castShadow: true,
  });
  // rooftop AC units
  const acMat = toon('#b8beb6');
  for (const [x, z, rot] of [[-5.5, -6.0, 0], [-4.6, -7.1, 0], [0.4, -5.3, Math.PI / 2]]) {
    const ag = new THREE.Group();
    ag.position.set(x, 5.77, z);
    ag.rotation.y = rot;
    g.add(ag);
    box(ag, 1.2, 0.6, 0.8, acMat, { y: 0.3, edge: true });
    box(ag, 1.24, 0.08, 0.84, toon('#8b9690'), { y: 0.64, edge: true });
    const fan = cylinder(ag, 0.28, 0.28, 0.03, toon('#6b7671'), {
      y: 0.69,
      edge: false,
      segments: 20,
    });
    const hub = cylinder(ag, 0.06, 0.06, 0.04, toon('#4b5754'), {
      y: 0.71,
      edge: false,
      segments: 10,
    });
    for (let i = 0; i < 4; i++) {
      box(ag, 0.53, 0.012, 0.012, toon('#dfe2d7'), {
        y: 0.72,
        z: 0,
        ry: (i * Math.PI) / 4,
        edge: false,
        castShadow: false,
      });
    }
  }
  // vent pipes and antenna
  for (const [x, z, h] of [[-6.6, -3.8, 1.3], [1.7, -8.7, 1.5]]) {
    cylinder(g, 0.12, 0.14, h, toon('#75817b'), {
      x,
      y: 5.66 + h / 2,
      z,
      edge: true,
      segments: 10,
    });
    const cap = cylinder(g, 0.2, 0.14, 0.12, toon('#5b6762'), {
      x,
      y: 5.66 + h + 0.06,
      z,
      edge: true,
      segments: 10,
    });
  }
  cylinder(g, 0.022, 0.03, 3.7, toon('#5e6b67'), {
    x: 1.0,
    y: 5.66 + 1.85,
    z: -8.9,
    edge: false,
    segments: 6,
  });
  for (let i = 0; i < 3; i++) {
    box(g, 0.65, 0.018, 0.018, toon('#5e6b67'), {
      x: 1.0,
      y: 7.1 + i * 0.24,
      z: -8.9,
      edge: false,
      castShadow: false,
    });
  }
  // roof safety rail at the back
  for (let i = 0; i < 8; i++) {
    cylinder(g, 0.018, 0.018, 0.55, toon('#6b7770'), {
      x: -6.9 + i * 1.4,
      y: 5.95,
      z: -10.45,
      edge: false,
      segments: 5,
    });
  }
  for (const y of [6.18, 6.05]) {
    box(g, 10.0, 0.024, 0.03, toon('#6b7770'), {
      x: -2.5,
      y,
      z: -10.45,
      edge: false,
      castShadow: false,
    });
  }
  // small lit 24H box on the roof edge
  const roofSignTex = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1b4a49';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffe8b7';
    ctx.font = '900 72px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('24H', w / 2, 86);
    ctx.font = `500 18px "Yu Gothic", sans-serif`;
    ctx.fillText('星降マート', w / 2, 112);
    ctx.textAlign = 'left';
  });
  box(g, 1.4, 0.7, 0.1, toon('#1f4a49'), {
    x: 0.2,
    y: 6.08,
    z: -10.58,
    edge: true,
  });
  const rs = new THREE.Mesh(
    new THREE.PlaneGeometry(1.26, 0.56),
    new THREE.MeshBasicMaterial({ map: roofSignTex, toneMapped: false }),
  );
  rs.position.set(0.2, 6.08, -10.522);
  g.add(rs);
}

/* ---------------------------------------------------------------- */
/*  shell + update                                                   */
/* ---------------------------------------------------------------- */

export function createStore(scene) {
  const store = new THREE.Group();
  store.name = 'hoshifuru-mart';
  scene.add(store);
  const state = {
    doorsOpen: 0,
    steamOrigin: new THREE.Vector3(),
    fans: [],
  };

  const shellWall = toon('#e8e0ce', { emissive: 0x251e13, emissiveIntensity: 0.15 });
  const cream = toon('#dfd5c0');
  const teal = toon('#25504f');
  const darkTeal = toon('#193b3e');

  // foundation
  box(store, 10.35, 0.18, 12.75, toon('#465355'), {
    x: -2.5,
    y: 0.25,
    z: -4.35,
    edge: true,
    castShadow: true,
  });
  box(store, 10.16, 0.12, 12.55, toon('#d6cbb5'), {
    x: -2.5,
    y: 0.36,
    z: -4.35,
    edge: true,
    castShadow: false,
  });

  // back + side shell
  box(store, 10.15, 5.18, 0.3, shellWall, {
    x: -2.5,
    y: 2.76,
    z: -10.35,
    edge: true,
    edgeThreshold: 40,
    castShadow: true,
  });
  box(store, 0.3, 5.18, 12.1, shellWall, {
    x: -7.35,
    y: 2.76,
    z: -4.35,
    edge: true,
    edgeThreshold: 40,
    castShadow: true,
  });
  // front upper fascia
  box(store, 10.15, 1.78, 0.3, shellWall, {
    x: -2.5,
    y: 4.61,
    z: 1.8,
    edge: true,
    edgeThreshold: 35,
    castShadow: true,
  });
  // east upper fascia
  box(store, 0.3, 1.78, 12.1, shellWall, {
    x: 2.5,
    y: 4.61,
    z: -4.35,
    edge: true,
    edgeThreshold: 35,
    castShadow: true,
  });
  // dark structural posts
  for (const x of [-7.36, -4.9, -2.5, 2.5]) {
    box(store, 0.13, 3.48, 0.17, darkTeal, {
      x,
      y: 1.9,
      z: 1.88,
      edge: true,
      castShadow: false,
    });
  }
  for (const z of [-10.35, -7.65, -5.05, -2.45, 0.15, 1.82]) {
    box(store, 0.17, 3.48, 0.13, darkTeal, {
      x: 2.58,
      y: 1.9,
      z,
      edge: true,
      castShadow: false,
    });
  }
  // lower kick panels + beams
  box(store, 10.15, 0.3, 0.24, darkTeal, {
    x: -2.5,
    y: 0.3,
    z: 1.89,
    edge: true,
    castShadow: false,
  });
  box(store, 0.24, 0.3, 12.1, darkTeal, {
    x: 2.58,
    y: 0.3,
    z: -4.35,
    edge: true,
    castShadow: false,
  });
  box(store, 10.15, 0.24, 0.24, teal, {
    x: -2.5,
    y: 3.62,
    z: 1.9,
    edge: true,
    castShadow: false,
  });
  box(store, 0.24, 0.24, 12.1, teal, {
    x: 2.58,
    y: 3.62,
    z: -4.35,
    edge: true,
    castShadow: false,
  });

  // corner caps
  for (const [x, z] of [
    [-7.43, -10.43],
    [-7.43, 1.88],
    [2.58, -10.43],
    [2.58, 1.88],
  ]) {
    box(store, 0.22, 5.38, 0.22, darkTeal, {
      x,
      y: 2.77,
      z,
      edge: true,
      castShadow: true,
    });
  }

  // interior floor
  const floorTex = makeInteriorFloorTexture();
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    color: 0xb39a75,
    roughness: 0.44,
    metalness: 0.06,
    emissive: 0x34200d,
    emissiveIntensity: 0.18,
    envMapIntensity: 0.3,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9.55, 11.9), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-2.5, FLOOR + 0.005, -4.35);
  floor.receiveShadow = true;
  store.add(floor);
  // soft glossy pool under the ceiling lights
  for (const x of [-5.8, -3.5, -1.1, 1.0]) {
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 4.4),
      new THREE.MeshBasicMaterial({
        map: getGlowTexture(),
        color: 0xffe1ab,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, FLOOR + 0.01, -5.5);
    store.add(pool);
  }
  // interior walls
  box(store, 9.7, 3.5, 0.1, toon('#f2ead7', { emissive: 0x4b2d12, emissiveIntensity: 0.24 }), {
    x: -2.5,
    y: 1.96,
    z: -10.23,
    edge: true,
    castShadow: false,
  });
  box(store, 0.1, 3.5, 11.7, toon('#eee7d5', { emissive: 0x4b2d12, emissiveIntensity: 0.24 }), {
    x: -7.19,
    y: 1.96,
    z: -4.35,
    edge: true,
    castShadow: false,
  });
  // The east side is almost entirely glazing, so only a shallow header
  // remains above the shop windows; a full wall here would hide the interior.
  box(store, 0.1, 0.26, 11.7, toon('#f0e8d6', { emissive: 0x4b2d12, emissiveIntensity: 0.24 }), {
    x: 2.4,
    y: 3.58,
    z: -4.35,
    edge: false,
    castShadow: false,
  });
  // wall base strips
  box(store, 9.65, 0.13, 0.04, teal, { x: -2.5, y: 0.42, z: -10.16, edge: false });
  box(store, 0.04, 0.13, 11.55, teal, { x: -7.13, y: 0.42, z: -4.35, edge: false });
  box(store, 0.04, 0.13, 11.55, teal, { x: 2.34, y: 0.42, z: -4.35, edge: false });

  addCeiling(store);
  addDrinkWall(store);
  addStaffDoor(store);
  addMagazineRack(store);
  addATM(store);
  addWestWallDetails(store);
  addIceCreamFreezer(store);
  addCoffeeStation(store);
  addCigaretteDisplay(store);
  addInteriorPosters(store);
  addAisleSigns(store);
  addFloorGuides(store);
  addBaskets(store);
  addEntranceRack(store);

  const productItems = [];
  addGondola(store, -4.6, -3.7, productItems);
  addGondola(store, -4.6, -6.12, productItems);
  addGondola(store, -4.6, -8.52, productItems);
  addFrontDisplay(store, productItems);
  addPromoIsland(store);
  addCheckout(store, state);
  createProductInstances(store, productItems);

  addGlazing(store, state);
  addCanopy(store, state);
  addSigns(store, state);
  addExteriorAC(store, state);
  addRooftop(store);

  // warm interior lighting
  const interiorLights = [];
  for (const [x, z, intensity, dist] of [
    [-5.1, -2.8, 34, 9.0],
    [-3.7, -6.2, 33, 9.2],
    [-0.3, -4.7, 25, 8.4],
    [1.3, -8.4, 18, 7.0],
  ]) {
    const l = new THREE.PointLight(0xffc17a, intensity, dist, 1.8);
    l.position.set(x, 3.15, z);
    store.add(l);
    interiorLights.push(l);
  }
  const entranceLight = new THREE.PointLight(0xffb76d, 17, 7.0, 2.0);
  entranceLight.position.set(0.5, 2.8, 2.5);
  store.add(entranceLight);
  state.interiorLights = interiorLights;

  // soft warm haze inside the glazing, like a camera bloom pass
  for (const [x, y, z, size, opacity] of [
    [-4.3, 2.35, -3.2, 5.4, 0.045],
    [0.5, 2.25, -0.7, 4.0, 0.055],
  ]) {
    const haze = glowSprite(0xffb267, size, opacity, store);
    haze.position.set(x, y, z);
  }

  // steam sprites above oden
  const steamSprites = [];
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: 0xffe2bb,
      transparent: true,
      opacity: 0.035,
      blending: THREE.NormalBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(state.steamOrigin);
    sp.position.x += (rand() - 0.5) * 0.35;
    sp.position.z += (rand() - 0.5) * 0.25;
    sp.scale.setScalar(0.16 + rand() * 0.12);
    sp.userData.phase = rand();
    sp.userData.speed = 0.62 + rand() * 0.32;
    sp.userData.baseX = sp.position.x;
    sp.userData.baseZ = sp.position.z;
    store.add(sp);
    steamSprites.push(sp);
  }
  state.steamSprites = steamSprites;

  // emergency sign, small sticker on the door and postbox details
  const numberTex = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f4e9d1';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4b605a';
    ctx.font = `600 22px "Yu Gothic", sans-serif`;
    ctx.fillText('星見町 4-17-2', 18, 44);
    ctx.fillStyle = '#a3664e';
    ctx.font = `800 35px ${'Trebuchet MS'}`;
    ctx.fillText('24', 18, 90);
    ctx.fillStyle = '#5c6f68';
    ctx.font = '500 14px "Trebuchet MS", sans-serif';
    ctx.fillText('HOSHIMI-CHO', 75, 90);
  });
  addTexturedPanel(store, numberTex, {
    w: 0.62,
    h: 0.31,
    x: 2.63,
    y: 1.14,
    z: 1.12,
    ry: Math.PI / 2,
  });

  // subtle animation setup
  let opened = 0;
  const steamOrigin = state.steamOrigin.clone();

  function update(time, dt) {
    // automatic sliding door (a slow, lonely little rhythm)
    const period = 19.0;
    const offset = 15.2;
    const local = (time + offset) % period;
    let target = 0;
    if (local < 0.95) target = smoothstep(0, 1, local / 0.95);
    else if (local < 4.2) target = 1;
    else if (local < 5.8) target = 1 - smoothstep(4.2, 5.8, local);
    const speed = 3.8;
    opened += clamp(target - opened, -speed * dt, speed * dt);
    state.doorsOpen = opened;
    if (state.leftDoor) state.leftDoor.position.x = state.leftDoor.userData.closedX - opened * 0.86;
    if (state.rightDoor) state.rightDoor.position.x = state.rightDoor.userData.closedX + opened * 0.86;
    if (state.doorSpill) {
      state.doorSpill.material.opacity = 0.06 + opened * 0.16;
      state.doorSpill.scale.setScalar(0.92 + opened * 0.12);
    }
    if (state.sensorMat) {
      const sensorOpen = opened > 0.15;
      state.sensorMat.color.set(sensorOpen ? 0x9fffe1 : 0xe46755);
    }
    if (state.rainTex) {
      state.rainTex.offset.y = -(time * 0.055 % 1);
      state.rainTex.offset.x = Math.sin(time * 0.03) * 0.02;
    }
    if (state.rainMats) {
      for (let i = 0; i < state.rainMats.length; i++) {
        state.rainMats[i].opacity = 0.2 + 0.075 * (0.5 + 0.5 * Math.sin(time * 0.6 + i * 1.7));
      }
    }
    // sign flicker: mostly alive, with a tiny stutter now and then
    const cycle = (time + 4.1) % 21.3;
    let dip = 1;
    if (cycle > 14.2 && cycle < 15.05) {
      const p = (cycle - 14.2) / 0.85;
      dip = p < 0.18 ? 0.38 + p * 2.7 : p < 0.26 ? 0.96 : p < 0.42 ? 0.5 : 1;
    } else if (cycle > 7.2 && cycle < 7.55) {
      dip = 0.72;
    }
    const softPulse = 0.965 + Math.sin(time * 1.8) * 0.012;
    if (state.southSignMat) {
      const v = softPulse * dip;
      state.southSignMat.color.setRGB(v, v * 0.995, v * 0.96);
      state.eastSignMat.color.setRGB(v, v * 0.995, v * 0.96);
      state.verticalSignMat.color.setRGB(v, v * 0.995, v * 0.96);
      state.southGlow.material.opacity = 0.055 + 0.035 * v;
      state.eastGlow.material.opacity = 0.035 + 0.025 * v;
      state.bladeGlow.material.opacity = 0.07 + 0.035 * v;
    }
    if (state.fan) state.fan.rotation.x += dt * 2.4;
    // oden steam
    if (state.steamSprites) {
      state.steamSprites.forEach((sp) => {
        const life = (time * sp.userData.speed + sp.userData.phase) % 1;
        const y = steamOrigin.y + life * 0.95;
        sp.position.y = y;
        sp.position.x = sp.userData.baseX + Math.sin(time * 0.8 + sp.userData.phase * 6) * 0.07 * life;
        sp.position.z = sp.userData.baseZ + Math.cos(time * 0.55 + sp.userData.phase * 4) * 0.05 * life;
        sp.material.opacity = 0.055 * Math.sin(life * Math.PI) * (1 - life * 0.4);
        sp.scale.setScalar(0.13 + life * 0.26);
      });
    }
  }

  return { group: store, state, update };
}
