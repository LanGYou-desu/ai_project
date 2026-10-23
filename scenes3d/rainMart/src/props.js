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
  cylinderBetween,
  addWire,
  canvasTexture,
  fillRoundRect,
  glowSprite,
  getGlowTexture,
  makeLightCone,
  contactShadow,
  rand,
  randBetween,
  smoothstep,
  clamp,
} from './utils.js';
import { LAYOUT } from './world.js';
import {
  makeVendingTexture,
  makeBoardTexture,
  makeStreetNameTexture,
  makeParkingSignTexture,
  makeStopTexture,
} from './textures.js';

const N = LAYOUT.NEIGHBOR;
const WALK = LAYOUT.WALK_Y;

/* ------------------------------------------------------------------ */
/*  little local signs and painted cloth                              */
/* ------------------------------------------------------------------ */

function signTexture(text, sub, { bg = '#243f3d', fg = '#f7eacb', accent = '#ddb265', w = 640, h = 210 } = {}) {
  return canvasTexture(w, h, (ctx, ww, hh) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, ww, hh);
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, ww - 24, hh - 24);
    ctx.globalAlpha = 1;
    ctx.fillStyle = fg;
    ctx.font = `700 ${Math.round(hh * 0.34)}px "Yu Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(text, ww / 2, hh * 0.51);
    ctx.fillStyle = accent;
    ctx.font = '600 20px "Trebuchet MS", sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText(sub, ww / 2, hh * 0.78);
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
  });
}

function makeNorenTexture() {
  return canvasTexture(640, 340, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const panels = 4;
    const gap = 12;
    const pw = (w - gap * (panels - 1)) / panels;
    for (let i = 0; i < panels; i++) {
      const x = i * (pw + gap);
      ctx.fillStyle = '#233c43';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + pw, 0);
      ctx.lineTo(x + pw, h - 18);
      ctx.quadraticCurveTo(x + pw - 10, h + 3, x + pw / 2, h - 5);
      ctx.quadraticCurveTo(x + 10, h + 3, x, h - 18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(238,228,203,0.62)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.fillStyle = '#f2e6cc';
    ctx.font = `800 112px "Yu Mincho", "Yu Gothic", serif`;
    ctx.textAlign = 'center';
    ctx.fillText('こ も れ び', w / 2, 175);
    ctx.fillStyle = '#d3b06a';
    ctx.font = '500 25px "Trebuchet MS", sans-serif';
    ctx.letterSpacing = '9px';
    ctx.fillText('COFFEE  &  QUIET', w / 2, 228);
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
  });
}

function makeNeighborSignTexture() {
  return canvasTexture(1024, 260, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3f3127');
    g.addColorStop(1, '#241b16');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b28b55';
    ctx.lineWidth = 7;
    ctx.strokeRect(13, 13, w - 26, h - 26);
    ctx.fillStyle = '#f4e4bf';
    ctx.textAlign = 'center';
    ctx.font = `800 96px "Yu Mincho", "Yu Gothic", serif`;
    ctx.fillText('喫茶 こもれび', w / 2, 125);
    ctx.fillStyle = '#c9a969';
    ctx.font = '500 30px "Trebuchet MS", sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillText('KOMOREBI  COFFEE  ·  SINCE 1978', w / 2, 194);
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
  });
}

function makeAlleySignTexture() {
  return canvasTexture(220, 620, (ctx, w, h) => {
    ctx.fillStyle = '#d8c7a4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#7e6546';
    ctx.lineWidth = 7;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#344c47';
    ctx.font = `800 58px "Yu Gothic", sans-serif`;
    ctx.textAlign = 'center';
    const chars = ['路', '地', '入', '口'];
    chars.forEach((c, i) => ctx.fillText(c, w / 2, 94 + i * 86));
    ctx.fillStyle = '#a05b49';
    ctx.font = `700 26px "Yu Gothic", sans-serif`;
    ctx.fillText('ゆっくり', w / 2, 455);
    ctx.fillText('お進みください', w / 2, 492);
    ctx.fillStyle = '#6e7766';
    ctx.font = '600 17px "Trebuchet MS", sans-serif';
    ctx.fillText('ALLEY', w / 2, 548);
    ctx.textAlign = 'left';
  });
}

function makeWetFloorTexture() {
  return canvasTexture(320, 460, (ctx, w, h) => {
    ctx.fillStyle = '#d7b04e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#473e2d';
    ctx.lineWidth = 8;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = '#403a2a';
    ctx.textAlign = 'center';
    ctx.font = `800 45px "Yu Gothic", sans-serif`;
    ctx.fillText('足元注意', w / 2, 95);
    // little slipping pictogram
    ctx.lineWidth = 11;
    ctx.strokeStyle = '#403a2a';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(w / 2 - 22, 170, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 21, 188);
    ctx.lineTo(w / 2 - 2, 235);
    ctx.lineTo(w / 2 + 45, 220);
    ctx.moveTo(w / 2 - 2, 235);
    ctx.lineTo(w / 2 + 18, 282);
    ctx.lineTo(w / 2 + 62, 296);
    ctx.moveTo(w / 2 - 2, 235);
    ctx.lineTo(w / 2 - 30, 286);
    ctx.lineTo(w / 2 - 58, 278);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 50, 347);
    ctx.quadraticCurveTo(w / 2 + 15, 315, w / 2 + 76, 353);
    ctx.stroke();
    ctx.fillStyle = '#403a2a';
    ctx.font = '700 25px "Trebuchet MS", sans-serif';
    ctx.fillText('CAUTION  /  WET FLOOR', w / 2, 417);
    ctx.textAlign = 'left';
  });
}

function makeBinTexture(color, label, sub) {
  return canvasTexture(320, 456, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.12)');
    g.addColorStop(0.7, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // opening
    ctx.fillStyle = '#182323';
    fillRoundRect(ctx, 43, 42, w - 86, 68, 12, '#182323');
    ctx.fillStyle = '#8a9b95';
    ctx.fillRect(50, 48, w - 100, 5);
    // can silhouette
    ctx.strokeStyle = 'rgba(243,238,218,0.72)';
    ctx.lineWidth = 9;
    if (label === 'かん') {
      ctx.beginPath();
      ctx.arc(w / 2, 200, 53, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, 200, 22, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(w / 2 - 25, 153);
      ctx.lineTo(w / 2 + 23, 147);
      ctx.lineTo(w / 2 + 35, 238);
      ctx.lineTo(w / 2 - 37, 244);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.fillStyle = '#f3edd8';
    ctx.font = `800 43px "Yu Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, w / 2, 326);
    ctx.font = '600 19px "Trebuchet MS", sans-serif';
    ctx.fillStyle = 'rgba(243,237,216,0.8)';
    ctx.fillText(sub, w / 2, 363);
    ctx.textAlign = 'left';
  });
}

/* ------------------------------------------------------------------ */
/*  the quiet neighbouring coffee shop and the alley                   */
/* ------------------------------------------------------------------ */

function addNeighbor(root, state) {
  const g = new THREE.Group();
  g.name = 'komorebi-neighbor';
  root.add(g);

  const w = N.x1 - N.x0;
  const d = N.z1 - N.z0;
  const cx = (N.x0 + N.x1) / 2;
  const cz = (N.z0 + N.z1) / 2;
  const wallMat = toon('#796a59');
  const upperMat = toon('#9f9480');
  const wood = toon('#3e3028');
  const darkWood = toon('#2b2420');
  const roofMat = toon('#283c3d');
  const tileRidge = toon('#1a2b2e');

  // body
  box(g, w, 6.35, d, wallMat, {
    x: cx,
    y: WALK + 3.175,
    z: cz,
    edge: true,
    edgeThreshold: 35,
    castShadow: true,
  });
  box(g, w + 0.04, 2.1, 0.15, wood, {
    x: cx,
    y: WALK + 1.15,
    z: N.z1 + 0.06,
    edge: true,
    castShadow: true,
  });
  box(g, w + 0.02, 0.19, 0.19, darkWood, {
    x: cx,
    y: WALK + 2.3,
    z: N.z1 + 0.09,
    edge: true,
  });
  // base stone
  box(g, w + 0.08, 0.28, d + 0.08, toon('#4a5150'), {
    x: cx,
    y: WALK + 0.03,
    z: cz,
    edge: true,
  });

  // shutters, slats and little bolts
  const shutterMat = toon('#4a5f5d');
  for (let i = 0; i < 12; i++) {
    box(g, w - 0.75, 0.105, 0.05, shutterMat, {
      x: cx - 0.13,
      y: WALK + 0.43 + i * 0.122,
      z: N.z1 + 0.16,
      edge: false,
      castShadow: false,
    });
  }
  box(g, 0.06, 1.55, 0.1, darkWood, {
    x: cx - 0.14,
    y: WALK + 1.08,
    z: N.z1 + 0.22,
    edge: true,
  });
  // warm doorway near the alley
  const doorX = N.x1 - 0.6;
  box(g, 0.8, 2.0, 0.13, darkWood, {
    x: doorX,
    y: WALK + 1.0,
    z: N.z1 + 0.045,
    edge: true,
  });
  const doorGlowMat = new THREE.MeshBasicMaterial({ color: 0xffdfad, toneMapped: false });
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.26), doorGlowMat);
  doorGlow.position.set(doorX, WALK + 1.35, N.z1 + 0.12);
  g.add(doorGlow);
  // noren
  const norenTex = makeNorenTexture();
  const noren = new THREE.Mesh(
    new THREE.PlaneGeometry(1.22, 0.65),
    new THREE.MeshBasicMaterial({ map: norenTex, transparent: true, side: THREE.DoubleSide, toneMapped: true }),
  );
  noren.position.set(doorX, WALK + 2.1, N.z1 + 0.26);
  noren.rotation.x = -0.04;
  g.add(noren);
  // small shop sign
  const shopTex = makeNeighborSignTexture();
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 0.64),
    new THREE.MeshBasicMaterial({ map: shopTex, toneMapped: false }),
  );
  sign.position.set(cx - 0.2, WALK + 2.76, N.z1 + 0.18);
  g.add(sign);
  const signGlow = glowSprite(0xffc984, 1.9, 0.08, g);
  signGlow.position.set(cx - 0.2, WALK + 2.78, N.z1 + 0.3);

  // second floor warm windows
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffcf92, toneMapped: false });
  const windowBack = box(g, 2.25, 1.22, 0.06, windowMat, {
    x: cx - 0.3,
    y: WALK + 4.35,
    z: N.z1 + 0.13,
    edge: false,
    castShadow: false,
  });
  box(g, 2.45, 0.11, 0.16, darkWood, { x: cx - 0.3, y: WALK + 4.99, z: N.z1 + 0.18, edge: true });
  box(g, 2.45, 0.13, 0.2, darkWood, { x: cx - 0.3, y: WALK + 3.71, z: N.z1 + 0.18, edge: true });
  for (let i = 0; i < 3; i++) {
    box(g, 0.045, 1.25, 0.08, darkWood, {
      x: cx - 1.1 + i * 0.8,
      y: WALK + 4.35,
      z: N.z1 + 0.19,
      edge: false,
    });
  }
  for (let i = 0; i < 2; i++) {
    box(g, 2.2, 0.035, 0.06, darkWood, {
      x: cx - 0.3,
      y: WALK + 4.13 + i * 0.42,
      z: N.z1 + 0.19,
      edge: false,
    });
  }
  // roofline / awning over the storefront
  box(g, w + 0.55, 0.14, 1.05, roofMat, {
    x: cx,
    y: WALK + 3.38,
    z: N.z1 + 0.34,
    rx: -0.13,
    edge: true,
    edgeThreshold: 30,
    castShadow: true,
  });
  box(g, w + 0.6, 0.12, 0.18, tileRidge, {
    x: cx,
    y: WALK + 3.35,
    z: N.z1 + 0.82,
    edge: true,
  });
  // tiled gable roof top
  const roofY = WALK + 6.45;
  for (const side of [-1, 1]) {
    const panel = box(g, w / 2 + 0.42, 0.16, d + 0.8, roofMat, {
      x: cx + side * (w / 4 + 0.05),
      y: roofY + 0.22,
      z: cz,
      rz: -side * 0.24,
      edge: true,
      edgeThreshold: 32,
      castShadow: true,
    });
  }
  box(g, 0.16, 0.16, d + 0.92, tileRidge, {
    x: cx,
    y: roofY + 0.56,
    z: cz,
    edge: true,
  });
  // roof tile lines
  for (let i = 0; i < 12; i++) {
    box(g, 0.025, 0.03, d + 0.8, toon('#16282b'), {
      x: N.x0 + 0.35 + i * 0.27,
      y: roofY + 0.55,
      z: cz,
      rz: 0.25,
      edge: false,
      castShadow: false,
    });
  }

  // gutter + drainpipe at alley edge
  cylinder(g, 0.055, 0.055, 2.9, toon('#525e5b'), {
    x: N.x1 - 0.08,
    y: WALK + 1.6,
    z: N.z1 + 0.24,
    edge: true,
    segments: 8,
    castShadow: false,
  });

  // lantern by the door
  const lantern = new THREE.Group();
  lantern.position.set(doorX - 0.65, WALK + 2.04, N.z1 + 0.16);
  g.add(lantern);
  cylinder(lantern, 0.055, 0.055, 0.04, toon('#332b24'), { y: 0.29, edge: false, segments: 8 });
  cylinder(lantern, 0.14, 0.14, 0.36, new THREE.MeshBasicMaterial({ color: 0xf4c17c, toneMapped: false }), {
    y: 0.06,
    edge: false,
    segments: 12,
    castShadow: false,
  });
  for (let i = 0; i < 5; i++) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.141, 0.006, 4, 14),
      toon('#8c5439'),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.1 + i * 0.08;
    lantern.add(band);
  }
  cylinder(lantern, 0.08, 0.1, 0.1, toon('#5b3d2b'), { y: -0.17, edge: false, segments: 8 });
  const lGlow = glowSprite(0xffb66f, 1.3, 0.2, g);
  lGlow.position.copy(lantern.position).add(new THREE.Vector3(0, 0.08, 0.15));

  const warmLight = new THREE.PointLight(0xffad6d, 5.5, 4.2, 2.0);
  warmLight.position.set(doorX, WALK + 2.05, N.z1 + 0.72);
  g.add(warmLight);

  // old shop planters
  const potMat = toon('#6b5140');
  const leafMat = toon('#29423b');
  for (let i = 0; i < 2; i++) {
    const px = N.x0 + 0.35 + i * 0.48;
    const pz = N.z1 + 0.56 + i * 0.11;
    cylinder(g, 0.14, 0.11, 0.25, potMat, {
      x: px,
      y: WALK + 0.14,
      z: pz,
      edge: true,
      segments: 10,
      castShadow: true,
    });
    for (let j = 0; j < 4; j++) {
      const leaf = sphere(g, 0.11, leafMat, {
        x: px + (rand() - 0.5) * 0.22,
        y: WALK + 0.39 + rand() * 0.15,
        z: pz + (rand() - 0.5) * 0.2,
        segments: 8,
        rings: 5,
        edge: false,
        castShadow: true,
      });
      leaf.scale.set(0.75, 1.3, 0.75);
    }
  }

  // an old wall meter and downlights
  box(g, 0.35, 0.45, 0.18, toon('#4b5b58'), {
    x: N.x1 - 0.16, y: WALK + 2.4, z: N.z1 + 0.13, edge: true, castShadow: false,
  });
  for (let i = 0; i < 2; i++) {
    cylinder(g, 0.04, 0.035, 0.12, toon('#544a3d'), {
      x: cx - 1.0 + i * 1.55,
      y: WALK + 3.22,
      z: N.z1 + 0.7,
      rx: Math.PI / 2,
      edge: false,
      segments: 8,
      castShadow: false,
    });
    const gl = glowSprite(0xffbf7d, 0.7, 0.1, g);
    gl.position.set(cx - 1.0 + i * 1.55, WALK + 3.2, N.z1 + 0.78);
  }

  return { group: g, windowGlow: windowBack };
}

function addAlleyDetails(root) {
  const g = new THREE.Group();
  root.add(g);
  const pipeMat = toon('#4c5a58');
  const steel = toon('#8a9691');

  // pipes climbing the store wall
  for (const [z, h, x] of [[-7.2, 4.8, -7.42], [0.55, 3.1, -7.42], [-2.8, 2.2, N.x1 + 0.15]]) {
    cylinder(g, 0.055, 0.055, h, pipeMat, {
      x,
      y: WALK + h / 2,
      z,
      edge: true,
      segments: 8,
      castShadow: false,
    });
  }
  for (let i = 0; i < 5; i++) {
    cylinder(g, 0.035, 0.035, 1.1, pipeMat, {
      x: -7.42,
      y: 1.1 + i * 0.6,
      z: -7.2,
      rz: Math.PI / 2,
      edge: false,
      segments: 6,
      castShadow: false,
    });
  }

  // wall-mounted AC boxes
  const addAlleyAC = (x, z, face = 1) => {
    const ag = new THREE.Group();
    ag.position.set(x, 2.05, z);
    g.add(ag);
    box(ag, 0.34, 0.62, 0.82, toon('#b9c1b8'), { edge: true, castShadow: false });
    const grill = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 5, 20), toon('#727d78'));
    grill.rotation.y = Math.PI / 2;
    grill.position.x = face * 0.18;
    ag.add(grill);
    for (let i = 0; i < 4; i++) {
      box(ag, 0.02, 0.016, 0.58, toon('#6e7974'), {
        x: face * 0.18,
        y: -0.16 + i * 0.1,
        edge: false,
        castShadow: false,
      });
    }
    // bracket
    box(ag, 0.4, 0.05, 0.06, toon('#4e5a56'), {
      x: face * 0.1,
      y: -0.35,
      z: 0.28,
      edge: false,
    });
    box(ag, 0.4, 0.05, 0.06, toon('#4e5a56'), {
      x: face * 0.1,
      y: -0.35,
      z: -0.28,
      edge: false,
    });
  };
  addAlleyAC(-7.45, -5.1, -1);
  addAlleyAC(N.x1 + 0.18, -4.2, 1);

  // small warm bulb on the store wall near the entrance
  const lampPos = new THREE.Vector3(-7.4, 2.85, 0.72);
  box(g, 0.16, 0.22, 0.3, toon('#344541'), {
    x: lampPos.x,
    y: lampPos.y + 0.12,
    z: lampPos.z,
    edge: true,
    castShadow: false,
  });
  const bulb = sphere(g, 0.07, new THREE.MeshBasicMaterial({ color: 0xffe3b4, toneMapped: false }), {
    x: lampPos.x - 0.12,
    y: lampPos.y,
    z: lampPos.z,
    segments: 10,
    rings: 8,
    edge: false,
    castShadow: false,
  });
  const bulbGlow = glowSprite(0xffbe78, 1.4, 0.25, g);
  bulbGlow.position.set(lampPos.x - 0.2, lampPos.y, lampPos.z);
  const alleyLight = new THREE.PointLight(0xffb36e, 5.0, 4.5, 2.0);
  alleyLight.position.set(lampPos.x - 0.25, lampPos.y - 0.1, lampPos.z);
  g.add(alleyLight);

  // stone step and old wooden crates
  box(g, 1.5, 0.09, 2.0, toon('#5c5a50'), {
    x: -8.6,
    y: WALK + 0.045,
    z: 0.8,
    edge: true,
    edgeThreshold: 35,
    castShadow: false,
  });
  for (let i = 0; i < 3; i++) {
    box(g, 0.56, 0.27, 0.42, toon('#6f4f38'), {
      x: -8.9 + (i % 2) * 0.18,
      y: WALK + 0.18 + Math.floor(i / 2) * 0.28,
      z: -7.6 - i * 0.5,
      edge: true,
      castShadow: true,
    });
  }
  // stacked empty bottles in a crate
  for (let i = 0; i < 5; i++) {
    cylinder(g, 0.045, 0.055, 0.25, toon('#5e766c'), {
      x: -8.9 + i * 0.09,
      y: WALK + 0.47,
      z: -6.4,
      edge: false,
      segments: 7,
      castShadow: false,
    });
  }

  // little sign across the alley mouth
  const beam = box(g, 2.25, 0.08, 0.1, toon('#4c3d30'), {
    x: -8.6,
    y: WALK + 3.1,
    z: 1.66,
    edge: true,
    castShadow: true,
  });
  const alleyTex = makeAlleySignTexture();
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 1.02),
    new THREE.MeshBasicMaterial({
      map: alleyTex,
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: true,
    }),
  );
  sign.position.set(-8.15, WALK + 2.55, 1.63);
  g.add(sign);
  const wire = cylinder(g, 0.006, 0.006, 0.11, toon('#46514d'), {
    x: -8.15,
    y: WALK + 3.07,
    z: 1.65,
    edge: false,
    segments: 4,
    castShadow: false,
  });

  // wet stones and moss along the wall base
  for (let i = 0; i < 8; i++) {
    const moss = sphere(g, 0.08 + rand() * 0.1, toon('#2d4035'), {
      x: -8.9 + rand() * 1.15,
      y: WALK + 0.02,
      z: -0.4 - i * 1.1 + rand() * 0.2,
      segments: 7,
      rings: 4,
      edge: false,
      castShadow: false,
    });
    moss.scale.y = 0.45;
  }
  return g;
}

function addNoticeBoard(root) {
  const g = new THREE.Group();
  g.position.set(-9.15, WALK, 2.77);
  g.rotation.y = 0.08;
  root.add(g);
  const wood = toon('#564537');
  const metal = toon('#54635f');
  const boardTex = makeBoardTexture();

  for (const x of [-0.62, 0.62]) {
    box(g, 0.09, 1.66, 0.09, wood, { x, y: 0.83, edge: true, castShadow: true });
    box(g, 0.2, 0.04, 0.24, metal, { x, y: 0.02, edge: true });
  }
  box(g, 1.48, 0.94, 0.09, wood, {
    x: 0,
    y: 1.31,
    edge: true,
    castShadow: true,
  });
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.78),
    new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: true }),
  );
  board.position.set(0, 1.31, 0.052);
  g.add(board);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.34, 0.82),
    new THREE.MeshPhysicalMaterial({
      color: 0xbed9e6,
      transparent: true,
      opacity: 0.1,
      roughness: 0.08,
      metalness: 0.1,
      envMapIntensity: 0.7,
      depthWrite: false,
    }),
  );
  glass.position.set(0, 1.31, 0.06);
  glass.renderOrder = 3;
  g.add(glass);
  // little roof
  box(g, 1.65, 0.08, 0.22, toon('#42514e'), {
    x: 0,
    y: 1.88,
    z: 0.02,
    rx: -0.08,
    edge: true,
    castShadow: true,
  });
  // tiny lamp
  const gl = glowSprite(0xffce8a, 0.95, 0.1, g);
  gl.position.set(0.3, 1.76, 0.22);
  return g;
}

/* ------------------------------------------------------------------ */
/*  utility pole, wires, lamps and signals                             */
/* ------------------------------------------------------------------ */

function addUtilityPole(root, state) {
  const g = new THREE.Group();
  root.add(g);
  const px = -13.0;
  const pz = 5.02;
  const baseY = WALK;
  const poleMat = toon('#4d5450');
  const metalMat = toon('#35413f');
  cylinder(g, 0.14, 0.22, 0.4, toon('#7f8580'), {
    x: px,
    y: baseY + 0.2,
    z: pz,
    edge: true,
    segments: 12,
    castShadow: true,
  });
  cylinder(g, 0.1, 0.16, 8.1, poleMat, {
    x: px,
    y: baseY + 4.25,
    z: pz,
    edge: true,
    segments: 12,
    castShadow: true,
  });
  // climbing pegs
  for (let i = 0; i < 7; i++) {
    cylinder(g, 0.012, 0.012, 0.32, toon('#81857c'), {
      x: px + 0.13,
      y: baseY + 1.0 + i * 0.55,
      z: pz,
      rz: Math.PI / 2,
      edge: false,
      segments: 5,
      castShadow: false,
    });
  }
  // arms and insulators
  const armY = [7.4, 6.92, 6.55];
  armY.forEach((y, idx) => {
    const length = idx === 2 ? 1.3 : 2.1;
    box(g, length, 0.1, 0.12, metalMat, {
      x: px,
      y: baseY + y,
      z: pz,
      ry: idx === 2 ? Math.PI / 2 : 0,
      edge: true,
      castShadow: true,
    });
    for (const off of idx === 2 ? [-0.45, 0.45] : [-0.78, -0.28, 0.28, 0.78]) {
      cylinder(g, 0.045, 0.06, 0.16, toon('#d6d2be'), {
        x: idx === 2 ? px : px + off,
        y: baseY + y + 0.13,
        z: idx === 2 ? pz + off : pz,
        edge: false,
        segments: 8,
        castShadow: false,
      });
    }
  });
  // transformer
  cylinder(g, 0.28, 0.3, 0.9, toon('#707871'), {
    x: px + 0.34,
    y: baseY + 5.9,
    z: pz - 0.2,
    edge: true,
    segments: 12,
    castShadow: true,
  });
  box(g, 0.38, 0.08, 0.38, toon('#4d5854'), {
    x: px + 0.34,
    y: baseY + 6.4,
    z: pz - 0.2,
    edge: true,
  });
  // pole bands & warning label
  for (const y of [2.2, 3.1, 4.25]) {
    const band = cylinder(g, 0.153, 0.153, 0.055, toon('#7d837a'), {
      x: px,
      y: baseY + y,
      z: pz,
      edge: false,
      segments: 12,
      castShadow: false,
    });
  }
  box(g, 0.26, 0.48, 0.025, toon('#ddc15f'), {
    x: px + 0.15,
    y: baseY + 1.65,
    z: pz + 0.12,
    edge: true,
    castShadow: false,
  });
  box(g, 0.02, 0.45, 0.17, toon('#7a6955'), {
    x: px + 0.16,
    y: baseY + 2.9,
    z: pz,
    edge: false,
    castShadow: false,
  });
  // street name sign
  const nameTex = makeStreetNameTexture();
  const namePlate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.36),
    new THREE.MeshBasicMaterial({ map: nameTex, side: THREE.DoubleSide, toneMapped: true }),
  );
  namePlate.position.set(px - 0.4, baseY + 3.5, pz + 0.13);
  namePlate.rotation.y = 0.05;
  g.add(namePlate);
  const namePlate2 = namePlate.clone();
  namePlate2.position.set(px + 0.13, baseY + 3.5, pz + 0.48);
  namePlate2.rotation.y = Math.PI / 2;
  g.add(namePlate2);
  // small security sticker
  const sticker = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.14),
    new THREE.MeshBasicMaterial({ color: 0xd5d9c7, toneMapped: true }),
  );
  sticker.position.set(px, baseY + 1.95, pz + 0.165);
  g.add(sticker);

  // wires: sagging diagonals that frame the miniature
  const topY = baseY + 7.45;
  addWire(g, [
    new THREE.Vector3(px - 0.78, topY, pz),
    new THREE.Vector3(0.8, topY - 1.1, 7.8),
    new THREE.Vector3(-14, topY - 0.4, 11.7),
  ], { color: 0x111a20, opacity: 0.88 });
  addWire(g, [
    new THREE.Vector3(px - 0.28, topY + 0.16, pz),
    new THREE.Vector3(2.9, topY - 0.85, 7.2),
    new THREE.Vector3(-14, topY - 0.1, 10.2),
  ], { color: 0x121b21, opacity: 0.82 });
  addWire(g, [
    new THREE.Vector3(px + 0.78, topY + 0.02, pz),
    new THREE.Vector3(10.2, topY - 0.8, 5.6),
    new THREE.Vector3(14, topY + 0.05, 4.8),
  ], { color: 0x10191f, opacity: 0.84 });
  addWire(g, [
    new THREE.Vector3(px, topY - 0.7, pz - 0.45),
    new THREE.Vector3(5.5, topY - 1.45, -4.6),
    new THREE.Vector3(5.8, topY - 0.45, -14),
  ], { color: 0x12191e, opacity: 0.8 });
  addWire(g, [
    new THREE.Vector3(px + 0.18, topY - 1.2, pz + 0.2),
    new THREE.Vector3(10.3, topY - 2.0, 8.7),
    new THREE.Vector3(14, topY - 1.0, 11.9),
  ], { color: 0x11191e, opacity: 0.8 });
  addWire(g, [
    new THREE.Vector3(px, topY - 1.1, pz),
    new THREE.Vector3(2.9, topY - 1.9, -8.8),
    new THREE.Vector3(3.5, topY - 1.3, -14),
  ], { color: 0x151c21, opacity: 0.75 });
  // lower communication cable
  addWire(g, [
    new THREE.Vector3(px, baseY + 5.95, pz - 0.2),
    new THREE.Vector3(-1.8, baseY + 5.4, 9.4),
    new THREE.Vector3(-14, baseY + 5.8, 12.8),
  ], { color: 0x0e151a, opacity: 0.82 });
  // little wire to the neighbor
  addWire(g, [
    new THREE.Vector3(px - 0.5, baseY + 6.4, pz),
    new THREE.Vector3(-1.0, baseY + 6.2, 2.0),
    new THREE.Vector3(-9.7, baseY + 5.9, 1.9),
  ], { color: 0x11191e, opacity: 0.7 });
  return { group: g, position: new THREE.Vector3(px, baseY, pz) };
}

function addStreetLamp(root, state) {
  const g = new THREE.Group();
  g.position.set(-8.9, WALK, 4.95);
  root.add(g);
  const metal = toon('#334a4b');
  const steel = toon('#74817e');
  cylinder(g, 0.17, 0.23, 0.28, toon('#57615f'), { y: 0.14, edge: true, segments: 12 });
  cylinder(g, 0.075, 0.13, 5.35, metal, {
    y: 2.8,
    edge: true,
    segments: 10,
    castShadow: true,
  });
  // curved arm made from a tube
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 5.4, 0),
    new THREE.Vector3(0, 5.82, 0.32),
    new THREE.Vector3(0, 5.94, 0.92),
    new THREE.Vector3(0, 5.8, 1.55),
  ]);
  const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.055, 6, false), metal);
  arm.castShadow = true;
  g.add(arm);
  // lamp head
  const head = new THREE.Group();
  head.position.set(0, 5.74, 1.68);
  g.add(head);
  box(head, 0.44, 0.16, 0.68, metal, { y: 0.03, edge: true, castShadow: true });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xe6f1f0, toneMapped: false });
  box(head, 0.32, 0.03, 0.46, lensMat, { y: -0.065, edge: false, castShadow: false });
  const glow = glowSprite(0xb8dcff, 3.4, 0.24, g);
  glow.position.set(0, 5.72, 1.68);
  const bulbGlow = glowSprite(0xeaf7ff, 1.3, 0.4, head);
  bulbGlow.position.set(0, -0.08, 0);

  const light = new THREE.SpotLight(0xbdd9ee, 85, 16, Math.PI * 0.28, 0.7, 1.5);
  light.position.set(-8.9, WALK + 5.68, 6.6);
  light.target.position.set(-7.2, 0, 9.4);
  light.castShadow = false;
  g.add(light);
  root.add(light.target);
  const fill = new THREE.PointLight(0xa9c9dd, 9, 8.5, 2.0);
  fill.position.set(-8.9, WALK + 5.45, 6.5);
  g.add(fill);

  // light shaft in the rain
  const cone = makeLightCone(0xaed5f0, 3.7, 6.4, 0.09);
  cone.position.set(0, 6.36, 1.68);
  g.add(cone);
  // tag on the pole
  const tagTex = canvasTexture(200, 100, (ctx, w, h) => {
    ctx.fillStyle = '#d5d9c8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7b543d';
    ctx.font = `700 25px "Yu Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('星見町', w / 2, 43);
    ctx.font = '500 15px "Trebuchet MS", sans-serif';
    ctx.fillText('No. 04-17', w / 2, 71);
    ctx.textAlign = 'left';
  });
  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.18),
    new THREE.MeshBasicMaterial({ map: tagTex, toneMapped: true }),
  );
  tag.position.set(0.13, 2.6, 0.2);
  g.add(tag);

  state.streetLamp = { light, fill };
  return g;
}

function addTrafficSignal(root, state) {
  const g = new THREE.Group();
  root.add(g);
  const poleX = 12.52;
  const poleZ = 5.2;
  const base = toon('#555d59');
  cylinder(g, 0.16, 0.22, 0.5, base, {
    x: poleX,
    y: 0.25,
    z: poleZ,
    edge: true,
    segments: 12,
    castShadow: true,
  });
  cylinder(g, 0.09, 0.14, 5.25, toon('#3b4643'), {
    x: poleX,
    y: 2.95,
    z: poleZ,
    edge: true,
    segments: 10,
    castShadow: true,
  });
  // arm across the east street
  cylinderBetween(g, [poleX, 5.25, poleZ], [9.3, 5.25, poleZ], 0.07, toon('#3d4945'), {
    edge: true,
    castShadow: true,
    segments: 8,
  });
  cylinderBetween(g, [9.3, 5.25, poleZ], [9.3, 4.95, poleZ], 0.035, toon('#4b5652'), {
    edge: false,
    segments: 6,
  });
  // housing faces the camera / southbound traffic
  const hg = new THREE.Group();
  hg.position.set(9.55, 4.78, poleZ - 0.02);
  g.add(hg);
  box(hg, 1.56, 0.48, 0.26, toon('#1f2b2b'), { edge: true, castShadow: true });
  box(hg, 1.62, 0.06, 0.32, toon('#111b1d'), { y: 0.27, edge: true, castShadow: false });
  const lenses = [
    { color: 0xee5d4b, x: -0.5 },
    { color: 0xefb64f, x: 0 },
    { color: 0x57c995, x: 0.5 },
  ];
  const glows = [];
  const mats = [];
  for (const lens of lenses) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.025, 6, 20), toon('#56615c'));
    ring.position.set(lens.x, 0, 0.145);
    hg.add(ring);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111718,
      emissive: lens.color,
      emissiveIntensity: 0.03,
      roughness: 0.28,
      metalness: 0.1,
    });
    mats.push(mat);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.125, 24), mat);
    disc.position.set(lens.x, 0, 0.148);
    hg.add(disc);
    // hood
    box(hg, 0.35, 0.045, 0.25, toon('#141f20'), {
      x: lens.x,
      y: 0.2,
      z: 0.09,
      edge: false,
      castShadow: false,
    });
    const gl = glowSprite(lens.color, 1.15, 0.02, hg);
    gl.position.set(lens.x, 0, 0.25);
    glows.push(gl);
  }
  // pedestrian signal on pole
  const pedGroup = new THREE.Group();
  pedGroup.position.set(poleX - 0.08, 2.85, poleZ + 0.2);
  g.add(pedGroup);
  box(pedGroup, 0.34, 0.68, 0.2, toon('#1d2929'), { edge: true, castShadow: false });
  const pedRedMat = new THREE.MeshBasicMaterial({ color: 0x5b2723, toneMapped: true });
  const pedGreenMat = new THREE.MeshBasicMaterial({ color: 0x3f6f5b, toneMapped: true });
  const pedRed = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), pedRedMat);
  pedRed.position.set(0, 0.16, 0.115);
  pedGroup.add(pedRed);
  const pedGreen = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), pedGreenMat);
  pedGreen.position.set(0, -0.16, 0.115);
  pedGroup.add(pedGreen);
  // ground reflection
  const reflection = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 4.2),
    new THREE.MeshBasicMaterial({
      map: getGlowTexture(),
      color: 0x66dca5,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  reflection.geometry.rotateX(-Math.PI / 2);
  reflection.position.set(9.6, 0.022, 8.0);
  reflection.rotation.y = Math.PI / 2;
  root.add(reflection);
  // sign plate on signal pole
  const plateTex = makeStreetNameTexture('星見町', 'HOSHIMI-CHO');
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.28),
    new THREE.MeshBasicMaterial({ map: plateTex, toneMapped: true, side: THREE.DoubleSide }),
  );
  plate.position.set(poleX - 0.14, 3.6, poleZ + 0.15);
  g.add(plate);
  // signal glow point
  const sigLight = new THREE.PointLight(0x66e1a4, 3.2, 6.0, 2.0);
  sigLight.position.set(9.55, 4.65, poleZ + 0.5);
  g.add(sigLight);

  state.traffic = {
    mats,
    glows,
    pedRedMat,
    pedGreenMat,
    reflection,
    light: sigLight,
    active: 2,
    cycle: 0,
  };
  return g;
}

/* ------------------------------------------------------------------ */
/*  street furniture                                                  */
/* ------------------------------------------------------------------ */

function addVendingMachines(root, state) {
  const machines = [];
  const positions = [
    { z: -3.45, scheme: 'aqua', light: 0x9cefff },
    { z: -4.62, scheme: 'coral', light: 0xffd6a4 },
  ];
  const bodyMat = toon('#d6dedc');
  const dark = toon('#2b393b');
  for (const item of positions) {
    const g = new THREE.Group();
    g.position.set(3.23, WALK, item.z);
    g.rotation.y = Math.PI / 2;
    root.add(g);
    // machine faces local +z, rotated to face +x
    box(g, 0.96, 1.94, 0.72, bodyMat, {
      y: 0.99,
      edge: true,
      edgeThreshold: 30,
      castShadow: true,
    });
    box(g, 1.0, 0.11, 0.78, dark, {
      y: 2.0,
      edge: true,
      castShadow: true,
    });
    box(g, 0.92, 0.05, 0.76, dark, {
      y: 0.055,
      edge: true,
      castShadow: false,
    });
    for (const sx of [-1, 1]) {
      box(g, 0.07, 1.94, 0.08, dark, {
        x: sx * 0.48,
        y: 0.98,
        z: 0.33,
        edge: true,
      });
    }
    const frontTex = makeVendingTexture(item.scheme);
    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 1.84),
      new THREE.MeshBasicMaterial({ map: frontTex, toneMapped: false }),
    );
    front.position.set(0, 1.02, 0.365);
    g.add(front);
    // selection buttons
    for (let i = 0; i < 4; i++) {
      const btn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8),
        new THREE.MeshBasicMaterial({ color: i === 3 ? 0xf4d58e : 0xa9e3d8, toneMapped: false }),
      );
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0.31, 0.83 - i * 0.1, 0.385);
      g.add(btn);
    }
    // little glow at the product window
    const gl = glowSprite(item.light, 1.6, 0.16, g);
    gl.position.set(0, 1.2, 0.48);
    const l = new THREE.PointLight(item.light, 3.0, 2.6, 2.0);
    l.position.set(0, 1.3, 0.55);
    g.add(l);
    contactShadow(g, 1.25, 0.9, 0.38, 0, 0.03, 0.012);
    machines.push(g);
  }
  state.vending = machines;
  return machines;
}

function addTrashBins(root) {
  const g = new THREE.Group();
  root.add(g);
  const bins = [
    { z: -6.38, color: '#3f5052', label: 'かん', sub: 'CANS / 飲料缶', hole: 'can' },
    { z: -7.02, color: '#445044', label: 'びん', sub: 'BOTTLES / びん', hole: 'bottle' },
    { z: -7.68, color: '#53484a', label: 'もえる', sub: 'BURNABLE / 一般ごみ', hole: 'bottle' },
  ];
  for (const bin of bins) {
    const bg = new THREE.Group();
    bg.position.set(3.19, WALK, bin.z);
    bg.rotation.y = Math.PI / 2;
    g.add(bg);
    const tex = makeBinTexture(bin.color, bin.label, bin.sub);
    box(bg, 0.56, 0.86, 0.5, toon(bin.color), {
      y: 0.43,
      edge: true,
      castShadow: true,
    });
    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.78),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: true }),
    );
    front.position.set(0, 0.46, 0.255);
    bg.add(front);
    box(bg, 0.6, 0.05, 0.54, toon('#2f3b3c'), { y: 0.87, edge: true, castShadow: false });
    contactShadow(bg, 0.7, 0.65, 0.3, 0, 0.02, 0.013);
  }
  return g;
}

function addBicycle(root) {
  const g = new THREE.Group();
  g.position.set(-6.25, WALK, 2.62);
  g.rotation.y = 0.04;
  g.rotation.z = -0.035;
  root.add(g);
  const tire = toon('#1c2428');
  const rim = toon('#78888a');
  const frame = toon('#4d7976');
  const chrome = toon('#b3c4c2');
  const saddle = toon('#513c34');
  const wheelR = 0.33;
  const wheelY = wheelR + 0.02;
  const axleX = 0.58;
  const makeWheel = (x) => {
    const w = new THREE.Mesh(new THREE.TorusGeometry(wheelR, 0.028, 7, 28), tire);
    w.position.set(x, wheelY, 0);
    w.castShadow = true;
    g.add(w);
    applyEdges(w, 40);
    const r = new THREE.Mesh(new THREE.TorusGeometry(wheelR - 0.04, 0.012, 5, 28), rim);
    r.position.set(x, wheelY, 0);
    g.add(r);
    const hub = cylinder(g, 0.038, 0.038, 0.09, chrome, {
      x,
      y: wheelY,
      z: 0,
      rx: Math.PI / 2,
      edge: false,
      segments: 10,
      castShadow: false,
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      cylinderBetween(
        g,
        [x, wheelY, 0],
        [x + Math.cos(a) * (wheelR - 0.045), wheelY + Math.sin(a) * (wheelR - 0.045), 0],
        0.0045,
        chrome,
        { segments: 4, castShadow: false },
      );
    }
    return w;
  };
  makeWheel(-axleX);
  makeWheel(axleX);
  // frame points
  const rearAxle = [-axleX, wheelY, 0];
  const frontAxle = [axleX, wheelY, 0];
  const crank = [-0.08, 0.34, 0];
  const seat = [-0.23, 0.9, 0];
  const head = [0.27, 0.86, 0];
  cylinderBetween(g, rearAxle, crank, 0.028, frame, { segments: 7, edge: true });
  cylinderBetween(g, rearAxle, seat, 0.024, frame, { segments: 7, edge: true });
  cylinderBetween(g, crank, seat, 0.032, frame, { segments: 7, edge: true });
  cylinderBetween(g, crank, head, 0.03, frame, { segments: 7, edge: true });
  cylinderBetween(g, seat, head, 0.03, frame, { segments: 7, edge: true });
  cylinderBetween(g, head, frontAxle, 0.026, chrome, { segments: 7, edge: true });
  // front fork crown
  cylinderBetween(g, [0.27, 0.94, 0], [0.3, 0.71, 0], 0.03, chrome, { segments: 7 });
  // saddle
  const seatMesh = sphere(g, 0.13, saddle, {
    x: -0.28,
    y: 0.98,
    z: 0,
    segments: 8,
    rings: 6,
    edge: false,
    castShadow: true,
  });
  seatMesh.scale.set(1.5, 0.42, 0.9);
  cylinderBetween(g, seat, [-0.28, 0.98, 0], 0.018, chrome, { segments: 5 });
  // handlebar
  cylinderBetween(g, [0.3, 0.91, 0], [0.33, 1.03, 0], 0.025, chrome, { segments: 6 });
  cylinderBetween(g, [0.33, 1.03, -0.23], [0.33, 1.03, 0.23], 0.022, chrome, { segments: 6, edge: true });
  for (const z of [-0.23, 0.23]) {
    cylinderBetween(g, [0.33, 1.03, z], [0.33, 1.03, z + Math.sign(z) * 0.1], 0.033, toon('#263032'), {
      segments: 6,
    });
  }
  // fenders
  for (const [x, start] of [[-axleX, 0.1], [axleX, 0.1]]) {
    const fender = new THREE.Mesh(
      new THREE.TorusGeometry(wheelR + 0.035, 0.013, 4, 18, Math.PI * 0.86),
      chrome,
    );
    fender.position.set(x, wheelY, 0);
    fender.rotation.z = 0.16;
    g.add(fender);
  }
  // chain guard and pedals
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 4, 18), toon('#2d3b3a'));
  chain.position.set(-0.08, 0.34, 0.02);
  g.add(chain);
  cylinderBetween(g, [-0.08, 0.34, 0.05], [-0.08, 0.34, 0.15], 0.012, chrome, { segments: 5 });
  box(g, 0.14, 0.03, 0.18, toon('#263534'), {
    x: -0.08, y: 0.35, z: 0.2, edge: true, castShadow: false,
  });
  // front basket
  const basketMat = toon('#6a7d79');
  const basket = new THREE.Group();
  basket.position.set(0.56, 0.9, 0);
  g.add(basket);
  for (const [x, y, z, w, h, d] of [
    [0, 0.1, -0.18, 0.38, 0.025, 0.025],
    [0, 0.1, 0.18, 0.38, 0.025, 0.025],
    [0, 0.3, -0.18, 0.38, 0.025, 0.025],
    [0, 0.3, 0.18, 0.38, 0.025, 0.025],
    [0.19, 0.2, 0, 0.025, 0.22, 0.38],
    [-0.19, 0.2, 0, 0.025, 0.22, 0.38],
    [0, 0.2, -0.19, 0.4, 0.22, 0.025],
    [0, 0.2, 0.19, 0.4, 0.22, 0.025],
  ]) {
    box(basket, w, h, d, basketMat, { x, y, z, edge: false, castShadow: false });
  }
  for (let i = 0; i < 4; i++) {
    box(basket, 0.025, 0.23, 0.39, basketMat, {
      x: -0.12 + i * 0.08,
      y: 0.21,
      z: 0,
      edge: false,
      castShadow: false,
    });
  }
  // kickstand
  cylinderBetween(g, [-0.08, 0.3, 0.02], [-0.25, 0.02, 0.12], 0.012, chrome, { segments: 5 });
  // tiny bell
  const bell = sphere(g, 0.035, chrome, {
    x: 0.36, y: 1.08, z: 0.1, segments: 8, rings: 6, edge: false, castShadow: false,
  });
  contactShadow(g, 1.7, 0.55, 0.35, 0, 0, 0.013);
  return g;
}

function addUmbrellaStand(root) {
  const g = new THREE.Group();
  g.position.set(1.92, WALK, 2.78);
  root.add(g);
  const metal = toon('#6c7f7d');
  const stand = cylinder(g, 0.28, 0.25, 0.62, metal, {
    y: 0.31,
    edge: true,
    segments: 14,
    castShadow: true,
  });
  stand.material = toon('#626f6b');
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.015, 5, 20), toon('#aebdb9'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.63;
  g.add(rim);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x1b3438,
    transparent: true,
    opacity: 0.7,
    roughness: 0.05,
    metalness: 0.5,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.25, 18), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.635;
  g.add(water);
  const umbrellas = [
    { color: 0x56a7a5, angle: -0.1, lean: 0.08 },
    { color: 0xbe735e, angle: 0.08, lean: -0.07 },
    { color: 0xd9c58c, angle: -0.03, lean: 0.13 },
    { color: 0x647f9a, angle: 0.13, lean: 0.04 },
    { color: 0xd9ded7, angle: -0.13, lean: -0.05, clear: true },
  ];
  umbrellas.forEach((u, i) => {
    const ug = new THREE.Group();
    ug.position.set((rand() - 0.5) * 0.2, 0.18, (rand() - 0.5) * 0.2);
    ug.rotation.z = u.lean;
    ug.rotation.x = u.angle;
    g.add(ug);
    const rod = cylinder(ug, 0.013, 0.013, 1.12, toon('#aeb6ad'), {
      y: 0.58,
      edge: false,
      segments: 6,
      castShadow: false,
    });
    // folded canopy
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: u.color,
      roughness: 0.34,
      metalness: 0.02,
      transparent: !!u.clear,
      opacity: u.clear ? 0.55 : 1,
    });
    const cone = mesh(new THREE.ConeGeometry(0.07, 0.57, 8), canopyMat, {
      parent: ug,
      y: 0.83,
      edge: false,
      castShadow: false,
    });
    for (let j = 0; j < 3; j++) {
      box(ug, 0.012, 0.48, 0.012, new THREE.MeshBasicMaterial({ color: 0x4b6460, transparent: true, opacity: 0.26 }), {
        x: Math.cos(j * 2.1) * 0.045,
        y: 0.82,
        z: Math.sin(j * 2.1) * 0.045,
        edge: false,
        castShadow: false,
      });
    }
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.013, 5, 12, Math.PI),
      toon('#d1c6ac'),
    );
    handle.position.set(0, 1.15, 0);
    handle.rotation.z = Math.PI / 2;
    ug.add(handle);
    cylinder(ug, 0.015, 0.018, 0.05, toon('#7a6854'), {
      y: 1.15,
      edge: false,
      segments: 6,
      castShadow: false,
    });
  });
  const signTex = canvasTexture(260, 120, (ctx, w, h) => {
    ctx.fillStyle = '#f0e3c5';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6e7e72';
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#355654';
    ctx.font = `700 33px "Yu Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('傘立て', w / 2, 52);
    ctx.font = '500 17px "Trebuchet MS", sans-serif';
    ctx.fillText('UMBRELLA', w / 2, 80);
    ctx.textAlign = 'left';
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.17),
    new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, toneMapped: true }),
  );
  sign.position.set(0.22, 0.9, 0.02);
  sign.rotation.y = -0.4;
  g.add(sign);
  contactShadow(g, 0.8, 0.8, 0.35);
  return g;
}

function addGuardrail(root, x, z, len, axis = 'x', state = null) {
  const g = new THREE.Group();
  root.add(g);
  const white = toon('#cfd7d1');
  const postMat = toon('#9fa9a3');
  const segments = Math.max(2, Math.round(len / 1.2));
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const px = axis === 'x' ? x + (t - 0.5) * len : x;
    const pz = axis === 'z' ? z + (t - 0.5) * len : z;
    points.push([px, pz]);
    cylinder(g, 0.045, 0.052, 0.76, postMat, {
      x: px,
      y: WALK + 0.38,
      z: pz,
      edge: true,
      segments: 8,
      castShadow: true,
    });
    if (i < segments) {
      const nx = axis === 'x' ? x + ((i + 1) / segments - 0.5) * len : x;
      const nz = axis === 'z' ? z + ((i + 1) / segments - 0.5) * len : z;
      // beam rails
      for (const h of [0.48, 0.7]) {
        cylinderBetween(
          g,
          [px, WALK + h, pz],
          [nx, WALK + h, nz],
          0.032,
          white,
          { segments: 6, edge: false },
        );
      }
    }
  }
  // reflectors
  for (let i = 0; i < 3; i++) {
    const t = (i + 0.5) / 3;
    const px = axis === 'x' ? x + (t - 0.5) * len : x;
    const pz = axis === 'z' ? z + (t - 0.5) * len : z;
    box(g, axis === 'x' ? 0.15 : 0.03, 0.07, axis === 'z' ? 0.15 : 0.03, new THREE.MeshBasicMaterial({
      color: 0xf0c56a,
      toneMapped: false,
    }), {
      x: px,
      y: WALK + 0.5,
      z: pz,
      edge: false,
      castShadow: false,
    });
  }
  return g;
}

function addRoadSigns(root, state) {
  // parking sign near the bays
  const g = new THREE.Group();
  g.position.set(13.28, WALK, -0.55);
  root.add(g);
  cylinder(g, 0.035, 0.04, 2.35, toon('#a0aaa4'), {
    y: 1.18,
    edge: true,
    segments: 8,
    castShadow: true,
  });
  const tex = makeParkingSignTexture();
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.94),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: true }),
  );
  sign.position.set(0, 1.8, 0.02);
  g.add(sign);
  // little arrow board below
  const arrowTex = signTexture('P → 24H', 'HOSHIFURU MART', {
    bg: '#244f4d',
    fg: '#f4e9ce',
    accent: '#d8b563',
    w: 512,
    h: 150,
  });
  const arrow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.19),
    new THREE.MeshBasicMaterial({ map: arrowTex, side: THREE.DoubleSide, toneMapped: true }),
  );
  arrow.position.set(0, 1.2, 0.02);
  g.add(arrow);
  const gl = glowSprite(0xffe0a1, 0.8, 0.05, g);
  gl.position.set(0, 1.8, 0.12);

  // stop sign by the side street, mounted on a simple pole
  const s = new THREE.Group();
  s.position.set(6.15, WALK, -1.2);
  s.rotation.y = -Math.PI / 2;
  root.add(s);
  cylinder(s, 0.03, 0.036, 2.5, toon('#9ea7a0'), { y: 1.25, edge: true, segments: 8 });
  const stopTex = makeStopTexture();
  const stop = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.65),
    new THREE.MeshBasicMaterial({
      map: stopTex,
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: true,
    }),
  );
  stop.position.set(0, 2.08, 0.02);
  s.add(stop);

  return g;
}

function addPostbox(root) {
  const g = new THREE.Group();
  g.position.set(4.58, WALK, 2.25);
  root.add(g);
  const red = toon('#b94742');
  box(g, 0.64, 0.12, 0.62, toon('#645d53'), { y: 0.06, edge: true, castShadow: true });
  cylinder(g, 0.235, 0.25, 1.05, red, {
    y: 0.64,
    edge: true,
    segments: 16,
    castShadow: true,
  });
  const dome = sphere(g, 0.235, red, {
    y: 1.16,
    segments: 16,
    rings: 10,
    edge: false,
    castShadow: true,
  });
  dome.scale.y = 0.5;
  box(g, 0.33, 0.06, 0.02, toon('#2c2422'), {
    y: 0.86, z: 0.245, edge: false, castShadow: false,
  });
  box(g, 0.42, 0.13, 0.025, toon('#efe5cc'), {
    y: 0.55, z: 0.247, edge: true, castShadow: false,
  });
  const labelTex = canvasTexture(400, 120, (ctx, w, h) => {
    ctx.fillStyle = '#efe5cc';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b94742';
    ctx.font = '800 47px "Yu Gothic", sans-serif';
    ctx.fillText('〒 星見町', 20, 74);
    ctx.fillStyle = '#7f6e5d';
    ctx.font = '500 16px "Trebuchet MS", sans-serif';
    ctx.fillText('JAPAN POST', 264, 69);
  });
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.11),
    new THREE.MeshBasicMaterial({ map: labelTex, toneMapped: true }),
  );
  label.position.set(0, 0.56, 0.258);
  g.add(label);
  contactShadow(g, 0.9, 0.8, 0.3, 0, 0, 0.013);
  return g;
}

function addCatBench(root, state) {
  const g = new THREE.Group();
  g.position.set(-2.8, WALK, 2.14);
  root.add(g);
  const wood = toon('#70553e');
  box(g, 0.85, 0.07, 0.34, wood, { y: 0.28, edge: true, castShadow: true });
  for (const x of [-0.33, 0.33]) {
    for (const z of [-0.1, 0.1]) {
      box(g, 0.06, 0.27, 0.06, toon('#5f4736'), {
        x, y: 0.135, z, edge: true, castShadow: false,
      });
    }
  }
  box(g, 0.6, 0.035, 0.27, toon('#9b5d50'), { y: 0.315, edge: false, castShadow: false });
  contactShadow(g, 1.0, 0.55, 0.32, 0, 0, 0.012);

  // the small orange cat who has decided the bench is home
  const cat = new THREE.Group();
  cat.position.set(0.0, 0.35, 0.02);
  cat.rotation.y = 0.25;
  g.add(cat);
  const orange = toon('#c47b43');
  const pale = toon('#ead5b7');
  const stripe = toon('#8d522f');

  const body = sphere(cat, 0.16, orange, {
    y: 0.16, segments: 14, rings: 10, edge: false, castShadow: true,
  });
  body.scale.set(1.0, 1.22, 0.9);
  const chest = sphere(cat, 0.11, pale, {
    y: 0.17, z: 0.1, segments: 10, rings: 8, edge: false, castShadow: false,
  });
  chest.scale.set(0.9, 1.1, 0.55);
  const head = sphere(cat, 0.14, orange, {
    y: 0.38, z: 0.05, segments: 14, rings: 10, edge: false, castShadow: true,
  });
  head.scale.set(1.1, 0.95, 0.95);
  for (const x of [-0.08, 0.08]) {
    const ear = mesh(new THREE.ConeGeometry(0.055, 0.1, 4), orange, {
      parent: cat, x, y: 0.49, z: 0.05, rz: x > 0 ? -0.18 : 0.18, edge: false, castShadow: true,
    });
    const inner = mesh(new THREE.ConeGeometry(0.027, 0.065, 4), toon('#d9a191'), {
      parent: cat, x, y: 0.478, z: 0.062, rz: x > 0 ? -0.18 : 0.18, edge: false,
    });
    const eye = sphere(cat, 0.018, new THREE.MeshBasicMaterial({ color: 0x152c2a }), {
      x: x * 0.65, y: 0.397, z: 0.175, segments: 7, rings: 5, edge: false,
    });
  }
  const muzzle = sphere(cat, 0.055, pale, {
    y: 0.345, z: 0.165, segments: 9, rings: 7, edge: false,
  });
  muzzle.scale.set(1.2, 0.75, 0.5);
  sphere(cat, 0.013, toon('#b56b64'), {
    y: 0.358, z: 0.207, segments: 6, rings: 5, edge: false,
  });
  // collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.013, 4, 14), toon('#b3433f'));
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.29, 0.04);
  cat.add(collar);
  sphere(cat, 0.018, toon('#ddba6c'), {
    y: 0.265, z: 0.14, segments: 5, rings: 4, edge: false,
  });
  // stripes
  for (let i = 0; i < 3; i++) {
    const st = box(cat, 0.14, 0.009, 0.06, stripe, {
      y: 0.055 + i * 0.09, z: 0.104, edge: false, castShadow: false,
    });
    st.rotation.z = -0.1;
  }
  // tail pivot for a lazy little sway
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0.12, 0.12, -0.05);
  cat.add(tailPivot);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 5, 18, Math.PI * 1.35), orange);
  tail.rotation.set(0, 0.5, -0.4);
  tail.position.set(0.13, 0.06, -0.03);
  tailPivot.add(tail);
  state.catTail = tailPivot;

  // tiny ceramic bowl
  cylinder(g, 0.075, 0.06, 0.035, toon('#dfd6bf'), {
    x: 0.27, y: 0.04, z: 0.2, edge: false, segments: 10, castShadow: false,
  });
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.055, 12),
    new THREE.MeshBasicMaterial({ color: 0x7ea6a7, transparent: true, opacity: 0.55 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0.27, 0.059, 0.2);
  g.add(water);
  return g;
}

function addPlants(root) {
  const pots = [
    [-12.85, 2.35, 0.18],
    [-12.3, 2.6, 0.13],
    [-9.45, 2.58, 0.15],
    [-7.82, -9.95, 0.16],
  ];
  const potMat = toon('#5d4a3c');
  const leafMat = toon('#2a4237');
  pots.forEach(([x, z, s], idx) => {
    cylinder(root, 0.16 * s * 5, 0.12 * s * 5, 0.24 * s * 5, potMat, {
      x, y: WALK + 0.12 * s * 5, z, edge: true, segments: 10, castShadow: true,
    });
    for (let i = 0; i < 5; i++) {
      const leaf = sphere(root, 0.13 * s * 4, leafMat, {
        x: x + (rand() - 0.5) * 0.24,
        y: WALK + 0.34 * s * 5 + rand() * 0.18,
        z: z + (rand() - 0.5) * 0.2,
        segments: 7,
        rings: 5,
        edge: false,
        castShadow: true,
      });
      leaf.scale.set(0.65, 1.25, 0.65);
    }
  });
}

function addBackService(root) {
  const g = new THREE.Group();
  root.add(g);
  const z = -10.53;
  // back utility door on the store shell
  box(g, 1.1, 2.05, 0.08, toon('#8e9a93'), {
    x: -1.7, y: 1.2, z: z - 0.02, edge: true, castShadow: true,
  });
  box(g, 1.2, 0.13, 0.15, toon('#526560'), {
    x: -1.7, y: 2.24, z: z - 0.07, edge: true, castShadow: false,
  });
  const gl = glowSprite(0xffcf8e, 1.2, 0.12, g);
  gl.position.set(-0.95, 2.5, z - 0.3);
  // wall lamp above the service door
  box(g, 0.14, 0.16, 0.25, toon('#394945'), {
    x: -0.95, y: 2.62, z: z - 0.14, edge: true, castShadow: false,
  });
  const lampBulb = sphere(g, 0.055, new THREE.MeshBasicMaterial({ color: 0xffe4b0, toneMapped: false }), {
    x: -0.95, y: 2.55, z: z - 0.28, segments: 8, rings: 6, edge: false,
  });
  // crates and service bins
  for (let i = 0; i < 3; i++) {
    box(g, 0.48, 0.28, 0.38, toon(['#8b6a49', '#a3835a', '#6e5c44'][i]), {
      x: -3.2 + (i % 2) * 0.25,
      y: WALK + 0.16 + Math.floor(i / 2) * 0.3,
      z: z - 0.8 - i * 0.3,
      edge: true,
      castShadow: true,
    });
  }
  const bin = new THREE.Group();
  bin.position.set(1.6, WALK, z - 0.9);
  g.add(bin);
  box(bin, 0.68, 1.1, 0.7, toon('#5a6460'), { y: 0.55, edge: true, castShadow: true });
  box(bin, 0.72, 0.07, 0.74, toon('#333d3a'), { y: 1.12, edge: true, castShadow: false });
  const binLabel = canvasTexture(300, 180, (ctx, w, h) => {
    ctx.fillStyle = '#c4c3ae';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3d4c49';
    ctx.font = `700 34px "Yu Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('資源回収', w / 2, 74);
    ctx.font = '500 18px "Trebuchet MS", sans-serif';
    ctx.fillText('RECYCLE', w / 2, 112);
  });
  const bl = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.22),
    new THREE.MeshBasicMaterial({ map: binLabel, toneMapped: true }),
  );
  bl.position.set(0, 0.72, 0.355);
  bin.add(bl);
  // vent pipe
  cylinder(g, 0.1, 0.11, 2.2, toon('#5d6b65'), {
    x: 1.9, y: 1.2, z: -10.46, edge: true, segments: 10, castShadow: false,
  });
  // cable running along the back wall
  addWire(g, [
    new THREE.Vector3(-7.3, 4.3, -10.55),
    new THREE.Vector3(-3.0, 4.05, -10.6),
    new THREE.Vector3(2.3, 4.3, -10.55),
  ], { color: 0x11191d, opacity: 0.7 });
  return g;
}

/* ------------------------------------------------------------------ */
/*  parked kei van + other small street stories                       */
/* ------------------------------------------------------------------ */

function addParkedCar(root) {
  const g = new THREE.Group();
  // nose-in to the middle parking bay, under the streetlight across the road
  g.position.set(12.06, 0.01, -6.45);
  g.rotation.y = Math.PI / 2;
  root.add(g);
  const bodyMat = toon('#d9d7c7');
  const dark = toon('#283336');
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x324d5a,
    roughness: 0.08,
    metalness: 0.45,
    transparent: true,
    opacity: 0.82,
    envMapIntensity: 1.2,
  });
  // wheels
  for (const z of [-1.05, 1.05]) {
    for (const x of [-0.72, 0.72]) {
      const tire = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.17, 16), dark, {
        parent: g, x, y: 0.3, z, rz: Math.PI / 2, edge: false, castShadow: true,
      });
      const hub = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 10), toon('#909b98'), {
        parent: g, x, y: 0.3, z, rz: Math.PI / 2, edge: false, castShadow: false,
      });
    }
  }
  // body
  box(g, 1.55, 0.52, 3.03, bodyMat, {
    y: 0.54, edge: true, edgeThreshold: 30, castShadow: true,
  });
  box(g, 1.46, 0.62, 2.5, bodyMat, {
    y: 1.05, z: -0.12, edge: true, edgeThreshold: 30, castShadow: true,
  });
  box(g, 1.38, 0.5, 1.46, toon('#cfcdbf'), {
    y: 1.52, z: -0.45, edge: true, edgeThreshold: 30, castShadow: true,
  });
  // roof lip
  box(g, 1.46, 0.06, 1.55, toon('#e3e1d3'), {
    y: 1.8, z: -0.45, edge: true, castShadow: false,
  });
  // side windows
  for (const x of [-0.745, 0.745]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.48), glass);
    win.position.set(x, 1.31, -0.32);
    win.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
    win.renderOrder = 2;
    g.add(win);
    const divider = box(g, 0.025, 0.46, 0.04, dark, {
      x: x + Math.sign(x) * 0.008, y: 1.31, z: 0.12, edge: false, castShadow: false,
    });
  }
  // windshield and rear
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.5), glass);
  windshield.position.set(0, 1.32, 1.12);
  windshield.rotation.y = Math.PI;
  windshield.rotation.x = -0.09;
  windshield.renderOrder = 2;
  g.add(windshield);
  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.46), glass);
  rearGlass.position.set(0, 1.3, -1.29);
  rearGlass.rotation.x = 0.1;
  rearGlass.renderOrder = 2;
  g.add(rearGlass);
  // headlights, tail lights, bumpers
  for (const x of [-0.5, 0.5]) {
    box(g, 0.3, 0.14, 0.04, new THREE.MeshBasicMaterial({ color: 0xbcc9bf, toneMapped: false }), {
      x, y: 0.62, z: 1.525, edge: false, castShadow: false,
    });
    box(g, 0.25, 0.16, 0.04, new THREE.MeshBasicMaterial({ color: 0xaf4f47, toneMapped: false }), {
      x, y: 0.62, z: -1.525, edge: false, castShadow: false,
    });
  }
  box(g, 1.56, 0.13, 0.1, toon('#7d8380'), {
    y: 0.32, z: 1.53, edge: true, castShadow: false,
  });
  box(g, 1.56, 0.13, 0.1, toon('#7d8380'), {
    y: 0.32, z: -1.53, edge: true, castShadow: false,
  });
  // side mirrors
  for (const x of [-0.82, 0.82]) {
    box(g, 0.09, 0.08, 0.15, dark, {
      x, y: 1.36, z: 0.76, edge: true, castShadow: false,
    });
    cylinder(g, 0.012, 0.012, 0.12, dark, {
      x: x * 0.97, y: 1.31, z: 0.76, rz: Math.PI / 2, edge: false, segments: 4, castShadow: false,
    });
  }
  // license plate
  const plateTex = canvasTexture(320, 110, (ctx, w, h) => {
    ctx.fillStyle = '#f0ead8';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#5f7464';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#37584f';
    ctx.font = '700 30px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('星見 580', w / 2, 49);
    ctx.font = '500 26px "Trebuchet MS", sans-serif';
    ctx.fillText('あ ・ 24-17', w / 2, 88);
    ctx.textAlign = 'left';
  });
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.14),
    new THREE.MeshBasicMaterial({ map: plateTex, toneMapped: true }),
  );
  plate.position.set(0, 0.45, -1.57);
  plate.rotation.y = Math.PI;
  g.add(plate);
  // a little roof rack
  for (const z of [-1.0, 0.05]) {
    box(g, 1.3, 0.04, 0.08, toon('#677370'), {
      y: 1.87, z, edge: true, castShadow: false,
    });
  }
  contactShadow(g, 2.2, 3.7, 0.48, 0, 0, 0.014);
  return g;
}

function addWetFloorSign(root) {
  const g = new THREE.Group();
  g.position.set(-1.35, WALK, 2.87);
  g.rotation.y = -0.24;
  root.add(g);
  const tex = makeWetFloorTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.DoubleSide,
    toneMapped: true,
  });
  const makePanel = (z, rot) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.46), mat);
    p.position.set(0, 0.32, z);
    p.rotation.x = rot;
    p.rotation.y = Math.PI;
    g.add(p);
    return p;
  };
  makePanel(0.11, 0.18);
  makePanel(-0.11, -0.18);
  box(g, 0.34, 0.025, 0.04, toon('#7c6a4b'), { y: 0.035, z: 0, edge: true, castShadow: false });
  const top = box(g, 0.34, 0.025, 0.06, toon('#7c6a4b'), {
    y: 0.56, z: 0, edge: true, castShadow: false,
  });
  contactShadow(g, 0.55, 0.5, 0.28, 0, 0, 0.013);
  return g;
}

/* ------------------------------------------------------------------ */
/*  outdoor props update and entry point                              */
/* ------------------------------------------------------------------ */

export function createStreetProps(scene, storeState) {
  const root = new THREE.Group();
  root.name = 'street-props';
  scene.add(root);
  const state = {};

  addNeighbor(root, state);
  addAlleyDetails(root);
  addNoticeBoard(root);
  addUtilityPole(root, state);
  addStreetLamp(root, state);
  addTrafficSignal(root, state);
  addVendingMachines(root, state);
  addTrashBins(root);
  addBicycle(root);
  addUmbrellaStand(root);
  addGuardrail(root, -11.6, 5.55, 4.2, 'x', state);
  addGuardrail(root, 5.55, -4.2, 3.8, 'z', state);
  addRoadSigns(root, state);
  addPostbox(root);
  addCatBench(root, state);
  addPlants(root);
  addBackService(root);
  addParkedCar(root);
  addWetFloorSign(root);
  // soft strip of practical light underneath the vending machines
  const vendGlow = glowSprite(0x9fe9ef, 2.8, 0.1, root);
  vendGlow.position.set(3.7, 0.55, -4.0);

  // subtle red puddle-paint by the traffic signal for the wet intersection
  const signalReflection = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 3.3),
    new THREE.MeshBasicMaterial({
      map: getGlowTexture(),
      color: 0x89efbc,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  signalReflection.geometry.rotateX(-Math.PI / 2);
  signalReflection.position.set(10.7, 0.023, 8.3);
  root.add(signalReflection);

  const update = (time, dt) => {
    // traffic signal cycle: green, amber, red, with a quiet pedestrian counterpart
    if (state.traffic) {
      const cyc = 31.0;
      const local = (time + 3.4) % cyc;
      let active = 2;
      if (local >= 13.0 && local < 15.1) active = 1;
      else if (local >= 15.1 && local < 25.0) active = 0;
      else active = 2;
      state.traffic.active = active;
      const colors = [0xee5d4b, 0xefb64f, 0x57c995];
      state.traffic.mats.forEach((mat, idx) => {
        const isActive = idx === active;
        mat.emissiveIntensity += ((isActive ? 2.4 : 0.035) - mat.emissiveIntensity) * Math.min(1, dt * 9);
        mat.color.setHex(isActive ? colors[idx] : 0x101617);
      });
      state.traffic.glows.forEach((gl, idx) => {
        gl.material.opacity += (((idx === active) ? 0.52 : 0.01) - gl.material.opacity) * Math.min(1, dt * 7);
        gl.material.color.setHex(colors[idx]);
      });
      const col = colors[active];
      state.traffic.reflection.material.color.setHex(col);
      state.traffic.reflection.material.opacity = 0.08 + (active === 2 ? 0.035 : 0);
      signalReflection.material.color.setHex(col);
      signalReflection.material.opacity = 0.035 + (active === 2 ? 0.03 : 0);
      state.traffic.light.color.setHex(col);
      // pedestrian is green only while cars are stopped
      const pedGreen = active === 0;
      state.traffic.pedGreenMat.color.setHex(pedGreen ? 0x6be2ae : 0x203c33);
      state.traffic.pedRedMat.color.setHex(pedGreen ? 0x3c2b28 : 0xe96352);
    }
    if (state.catTail) {
      state.catTail.rotation.y = Math.sin(time * 0.8) * 0.22 + Math.sin(time * 0.21) * 0.12;
      state.catTail.rotation.z = Math.sin(time * 1.3) * 0.05;
    }
  };

  return { root, state, update };
}
