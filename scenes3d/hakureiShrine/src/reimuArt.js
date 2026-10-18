import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Reimu Hakurei — hand-placed pixel art
 *
 * Design cues taken from her standard Touhou look:
 *   dark brown hair, a very large red hair bow, red eyes,
 *   yellow ascot, red vest over a white blouse, red skirt with a white
 *   hem, detached white sleeves with red ribbons, white hair tubes,
 *   white socks and red shoes.
 *
 * 4 columns × 3 rows, 64 px per cel:
 *  0 idle A        1 idle B        2 sweep wind-up  3 sweep stroke
 *  4 sweep low     5 sweep return  6 pause          7 jump crouch
 *  8 leap          9 descend      10 landing       11 blink
 * ------------------------------------------------------------------ */

export const CELL = 64;
export const COLS = 4;
export const ROWS = 3;

const INK = '#392d34';
const INK_SOFT = '#4a3840';
const HAIR = '#4c3532';
const HAIR_DARK = '#352729';
const HAIR_LIGHT = '#6b4942';
const HAIR_SHINE = '#8b6054';
const SKIN = '#f0cbaa';
const SKIN_SHADE = '#d4a381';
const SKIN_LIGHT = '#fae0c4';
const EYE_RED = '#ad3c44';
const EYE_DARK = '#67242c';
const WHITE = '#f2e9d6';
const WHITE_SHADE = '#d5c9b2';
const WHITE_LIGHT = '#fff9e8';
const RED = '#aa4246';
const RED_DARK = '#7c2e37';
const RED_LIGHT = '#c95e5e';
const BOW = '#a73a44';
const BOW_LIGHT = '#d16665';
const BOW_DARK = '#762732';
const ASCOT = '#d7ad58';
const ASCOT_LIGHT = '#f0d17f';
const ASCOT_DARK = '#9d7538';
const TUBE = '#f5ead4';
const TUBE_RED = '#b5494c';
const SHOE = '#8b343b';
const SHOE_LIGHT = '#b34c4f';
const PINK = '#d18f86';
const MOUTH = '#9c5957';
const STRAW = '#d1b071';
const STRAW_LIGHT = '#ead195';
const STRAW_SHADE = '#a68553';
const BROOM_WOOD = '#8c6a4a';
const BROOM_LIGHT = '#b28a61';
const BROOM_DARK = '#584231';

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function outlinedRect(ctx, x, y, w, h, fill, outline = INK) {
  rect(ctx, x - 1, y - 1, w + 2, h + 2, outline);
  rect(ctx, x, y, w, h, fill);
}

function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

function outlinedEllipse(ctx, cx, cy, rx, ry, fill, outline = INK) {
  ellipse(ctx, cx, cy, rx + 1, ry + 1, outline);
  ellipse(ctx, cx, cy, rx, ry, fill);
}

function line(ctx, x0, y0, x1, y1, color, width = 1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const half = Math.floor(width / 2);
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps);
    const y = Math.round(y0 + (dy * i) / steps);
    ctx.fillRect(x - half, y - half, width, width);
  }
}

function trapezoid(ctx, cx, top, bottom, topW, bottomW, fill) {
  const h = Math.max(1, bottom - top);
  for (let i = 0; i <= h; i++) {
    const w = topW + ((bottomW - topW) * i) / h;
    ctx.fillStyle = fill;
    ctx.fillRect(Math.round(cx - w / 2), top + i, Math.round(w), 1);
  }
}

function outlinedTrapezoid(ctx, cx, top, bottom, topW, bottomW, fill, outline = INK) {
  const h = Math.max(1, bottom - top);
  for (let i = 0; i <= h; i++) {
    const w = topW + ((bottomW - topW) * i) / h;
    rect(ctx, cx - w / 2 - 1, top - 1 + i, w + 2, 1, outline);
  }
  rect(ctx, cx - topW / 2 - 1, top - 1, topW + 2, 1, outline);
  rect(ctx, cx - bottomW / 2 - 1, bottom, bottomW + 2, 1, outline);
  trapezoid(ctx, cx, top, bottom, topW, bottomW, fill);
}

function drawBackHair(ctx, cx, headY, pose) {
  const shift = pose.lean || 0;
  const sway = pose.hairSway || 0;
  // A softly rounded curtain of long hair, mostly hidden by the body.
  const top = headY - 5;
  const bottom = headY + 17;
  for (let yy = top; yy <= bottom; yy++) {
    const t = (yy - top) / (bottom - top);
    const width = 22 + Math.sin(t * Math.PI) * 6 - t * 9;
    const offset = shift + sway * t * 0.5;
    rect(ctx, cx - width / 2 + offset - 1, yy, width + 2, 1, INK);
    rect(ctx, cx - width / 2 + offset, yy, width, 1, yy < top + 6 ? HAIR : HAIR_DARK);
  }
  // Ragged tips peeking out from behind the sleeves.
  for (let i = 0; i < 4; i++) {
    const x = cx - 10 + i * 7 + shift;
    rect(ctx, x, headY + 14, 2, 5 + (i % 2) * 2, i % 2 ? HAIR_DARK : HAIR);
  }
}

function drawBowTails(ctx, cx, headY, pose) {
  const dy = (pose.bowDy || 0) + (pose.bowLift || 0);
  const shift = pose.lean || 0;
  // Two ribbon tails hang behind the right side of the head.
  outlinedTrapezoid(ctx, cx + 14 + shift, headY - 1 + dy, headY + 13 + dy, 4, 3, BOW, INK);
  outlinedTrapezoid(ctx, cx + 19 + shift, headY - 3 + dy, headY + 9 + dy, 3, 2, BOW_DARK, INK);
  rect(ctx, cx + 14 + shift, headY + 11 + dy, 3, 1, BOW_LIGHT);
  rect(ctx, cx + 19 + shift, headY + 7 + dy, 2, 1, BOW_LIGHT);
}

function drawBowLoops(ctx, cx, headY, pose) {
  const dy = (pose.bowDy || 0) + (pose.bowLift || 0);
  const shift = pose.lean || 0;
  const cy = headY - 7 + dy;
  // A little loop tucked behind the head and the big iconic outer loop.
  outlinedEllipse(ctx, cx + 8 + shift, cy - 1, 5, 4, BOW, INK);
  outlinedEllipse(ctx, cx + 15 + shift, cy + 1, 6, 5, BOW, INK);
  ellipse(ctx, cx + 8 + shift, cy - 2, 3, 2, BOW_LIGHT);
  ellipse(ctx, cx + 15 + shift, cy, 4, 3, BOW_LIGHT);
  line(ctx, cx + 10 + shift, cy - 3, cx + 13 + shift, cy + 2, BOW_DARK, 1);
  rect(ctx, cx + 18 + shift, cy + 2, 2, 2, BOW_DARK);
  // The knot is drawn after the head so it crowns the hair.
}

function drawBowKnot(ctx, cx, headY, pose) {
  const dy = (pose.bowDy || 0) + (pose.bowLift || 0);
  const shift = pose.lean || 0;
  const x = cx + 9 + shift;
  const y = headY - 6 + dy;
  outlinedRect(ctx, x, y, 5, 6, BOW, INK);
  rect(ctx, x + 1, y + 1, 3, 2, BOW_LIGHT);
  rect(ctx, x, y + 4, 5, 1, BOW_DARK);
  rect(ctx, x + 4, y + 2, 1, 2, RED_DARK);
}

function drawLegs(ctx, cx, pose) {
  const mode = pose.legs || 'stand';
  if (mode === 'tuck') {
    outlinedRect(ctx, cx - 8, 53, 4, 4, SKIN);
    outlinedRect(ctx, cx + 4, 53, 4, 4, SKIN);
    outlinedRect(ctx, cx - 10, 56, 7, 3, WHITE);
    outlinedRect(ctx, cx + 4, 56, 7, 3, WHITE);
    outlinedRect(ctx, cx - 11, 58, 8, 3, SHOE);
    outlinedRect(ctx, cx + 4, 58, 8, 3, SHOE);
    rect(ctx, cx - 10, 58, 6, 1, SHOE_LIGHT);
    rect(ctx, cx + 5, 58, 6, 1, SHOE_LIGHT);
    return;
  }
  if (mode === 'crouch' || mode === 'land') {
    const spread = mode === 'land' ? 7 : 5;
    outlinedRect(ctx, cx - spread - 2, 53, 4, 5, SKIN);
    outlinedRect(ctx, cx + spread - 2, 53, 4, 5, SKIN);
    rect(ctx, cx - spread - 2, 56, 4, 1, WHITE);
    rect(ctx, cx + spread - 2, 56, 4, 1, WHITE);
    outlinedRect(ctx, cx - spread - 4, 57, 7, 3, WHITE);
    outlinedRect(ctx, cx + spread - 3, 57, 7, 3, WHITE);
    outlinedRect(ctx, cx - spread - 5, 59, 9, 3, SHOE);
    outlinedRect(ctx, cx + spread - 4, 59, 9, 3, SHOE);
    rect(ctx, cx - spread - 4, 59, 7, 1, SHOE_LIGHT);
    rect(ctx, cx + spread - 3, 59, 7, 1, SHOE_LIGHT);
    return;
  }
  outlinedRect(ctx, cx - 5, 52, 4, 6, SKIN);
  outlinedRect(ctx, cx + 2, 52, 4, 6, SKIN);
  rect(ctx, cx - 5, 57, 4, 2, WHITE);
  rect(ctx, cx + 2, 57, 4, 2, WHITE);
  rect(ctx, cx - 5, 58, 4, 1, WHITE_SHADE);
  rect(ctx, cx + 2, 58, 4, 1, WHITE_SHADE);
  outlinedRect(ctx, cx - 8, 59, 7, 3, SHOE);
  outlinedRect(ctx, cx + 1, 59, 7, 3, SHOE);
  rect(ctx, cx - 7, 59, 5, 1, SHOE_LIGHT);
  rect(ctx, cx + 2, 59, 5, 1, SHOE_LIGHT);
}

function drawSkirt(ctx, cx, bodyY, pose) {
  const top = 41 + bodyY;
  const flare = pose.skirtFlare || 0;
  const shift = pose.lean || 0;
  const sway = pose.skirtSway || 0;
  const bottom = top + 11 + (flare > 4 ? 1 : 0);
  const bottomW = 24 + flare;
  outlinedTrapezoid(ctx, cx + shift * 0.5 + sway, top, bottom, 16, bottomW, RED, INK);
  // Clean vertical pleats.
  for (let i = -2; i <= 2; i++) {
    const x = cx + shift * 0.5 + sway + i * 4;
    rect(ctx, x, top + 2, 1, 7, i % 2 ? RED_DARK : RED_LIGHT);
  }
  // White lining at the hem.
  trapezoid(ctx, cx + shift * 0.5 + sway, bottom - 2, bottom, bottomW - 2, bottomW, WHITE);
  rect(ctx, cx + shift * 0.5 + sway - bottomW / 2 + 2, bottom - 2, bottomW - 5, 1, WHITE_LIGHT);
  rect(ctx, cx + shift * 0.5 + sway - bottomW / 2 + 1, bottom, bottomW - 2, 1, WHITE_SHADE);
  // Red sash and a tiny gold tie.
  rect(ctx, cx + shift - 8, top, 16, 2, RED_DARK);
  rect(ctx, cx + shift - 7, top, 14, 1, RED_LIGHT);
  rect(ctx, cx + shift - 1, top, 3, 1, ASCOT_DARK);
  if (flare > 3) {
    for (const side of [-1, 1]) {
      const x0 = cx + shift + side * (bottomW / 2 - 2);
      line(ctx, x0, bottom - 4, x0 + side * (3 + flare * 0.35), bottom - 7, INK, 2);
      line(ctx, x0, bottom - 4, x0 + side * (3 + flare * 0.35), bottom - 7, RED, 1);
    }
  }
}

function drawTorso(ctx, cx, bodyY, pose) {
  const top = 32 + bodyY;
  const lean = pose.lean || 0;

  // Neck.
  rect(ctx, cx - 2 + lean, top - 1, 4, 4, SKIN);
  rect(ctx, cx - 2 + lean, top + 2, 4, 1, SKIN_SHADE);

  // White blouse. The red vest sits over it, leaving a white centre strip.
  outlinedTrapezoid(ctx, cx + lean, top + 1, top + 10, 14, 16, WHITE, INK);
  rect(ctx, cx - 7 + lean, top + 2, 14, 1, WHITE_LIGHT);
  // Red vest panels.
  for (const side of [-1, 1]) {
    const x = cx + lean + side * 4.5;
    trapezoid(ctx, x, top + 2, top + 10, 6, 7, RED);
    rect(ctx, x - 2, top + 2, 3, 1, RED_LIGHT);
    rect(ctx, cx + lean + side * 2, top + 2, 1, 7, WHITE_LIGHT);
    rect(ctx, x + side * 2, top + 3, 1, 6, RED_DARK);
  }
  rect(ctx, cx - 1 + lean, top + 2, 2, 7, WHITE);
  rect(ctx, cx + lean, top + 3, 1, 6, WHITE_SHADE);
  // Bare shoulders peeking out from the sleeveless vest.
  for (const side of [-1, 1]) {
    rect(ctx, cx + lean + side * 7, top + 2, 2, 2, SKIN);
    rect(ctx, cx + lean + side * 7, top + 4, 2, 1, SKIN_SHADE);
  }
  // White collar.
  rect(ctx, cx - 4 + lean, top + 1, 8, 1, WHITE_LIGHT);
  rect(ctx, cx - 3 + lean, top + 2, 2, 1, WHITE_SHADE);
  rect(ctx, cx + 1 + lean, top + 2, 2, 1, WHITE_SHADE);

  // Yellow ascot.
  outlinedRect(ctx, cx - 1 + lean, top + 1, 3, 3, ASCOT, ASCOT_DARK);
  rect(ctx, cx - 4 + lean, top + 2, 3, 2, ASCOT_LIGHT);
  rect(ctx, cx + 2 + lean, top + 2, 3, 2, ASCOT_LIGHT);
  rect(ctx, cx - 4 + lean, top + 3, 3, 1, ASCOT);
  rect(ctx, cx + 2 + lean, top + 3, 3, 1, ASCOT);
  rect(ctx, cx + lean, top + 4, 1, 1, ASCOT_DARK);
}

function drawBroom(ctx, pose) {
  const broom = pose.broom;
  if (!broom) return;
  const { grip, head } = broom;
  const topX = grip[0] + (pose.broomTopX ?? 2);
  const topY = grip[1] - (pose.broomTopY ?? 10);
  // Handle.
  line(ctx, topX, topY, head[0], head[1], INK, 5);
  line(ctx, topX, topY, head[0], head[1], BROOM_WOOD, 3);
  line(ctx, topX - 1, topY + 1, head[0] - 1, head[1] - 4, BROOM_LIGHT, 1);
  // Red binding at the brush head.
  outlinedRect(ctx, head[0] - 3, head[1] - 2, 7, 4, RED_DARK);
  rect(ctx, head[0] - 2, head[1] - 1, 4, 1, ASCOT);
  // Straw fan with a filled body and separate bristle hints.
  const dir = head[0] < grip[0] ? -1 : 1;
  const spread = broom.spread ?? 7;
  const ends = [];
  for (let i = -3; i <= 3; i++) {
    const ex = head[0] + i * spread * 0.6 + dir * 2.4;
    const ey = head[1] + 6 + Math.abs(i) * 0.6;
    ends.push([ex, ey]);
    line(ctx, head[0], head[1] + 1, ex, ey, INK, 2);
  }
  for (let i = 0; i < ends.length; i++) {
    const [ex, ey] = ends[i];
    line(ctx, head[0], head[1], ex, ey, i % 2 ? STRAW : STRAW_SHADE, 1);
    rect(ctx, ex, ey, 1, 1, STRAW_LIGHT);
  }
  trapezoid(ctx, head[0] + dir, head[1] + 2, head[1] + 5, 5, 10, STRAW);
  rect(ctx, head[0] - 2 + dir, head[1] + 2, 4, 1, STRAW_LIGHT);
}

function drawSleeve(ctx, sx, sy, hx, hy, side, pose) {
  // Detached white sleeve, with a soft shadow on the lower edge.
  line(ctx, sx, sy, hx, hy, INK, 8);
  line(ctx, sx, sy, hx, hy, WHITE, 6);
  line(ctx, sx + side, sy + 3, hx + side, hy + 2, WHITE_SHADE, 1);
  line(ctx, sx - side, sy - 1, hx - side, hy - 1, WHITE_LIGHT, 1);
  // Red shoulder ribbon and tails.
  rect(ctx, sx - 2, sy - 2, 4, 2, RED_DARK);
  rect(ctx, sx - 1, sy - 2, 2, 1, RED_LIGHT);
  rect(ctx, sx + side * 3, sy, 1, 4, RED_DARK);
  rect(ctx, sx + side * 4, sy + 1, 1, 2, RED);
  // Wide cuff with a red ribbon edge and hand.
  outlinedRect(ctx, hx - 3, hy - 2, 6, 4, WHITE, INK);
  rect(ctx, hx - 2, hy - 2, 4, 1, WHITE_LIGHT);
  rect(ctx, hx - 2, hy + 1, 4, 1, RED_DARK);
  outlinedRect(ctx, hx - 1, hy - 1, 3, 3, SKIN, INK);
  rect(ctx, hx + side, hy - 1, 1, 1, SKIN_LIGHT);
}

function drawSleeves(ctx, cx, bodyY, pose) {
  const lean = pose.lean || 0;
  const top = 33 + bodyY;
  const broom = pose.broom;
  if (!broom) return;
  const grip = broom.grip;
  const spread = pose.arms === 'spread';
  const shoulderL = [cx - 7 + lean, top];
  const shoulderR = [cx + 7 + lean, top];
  // One hand guides the broom; the other sleeve hangs naturally at her side.
  const handR = spread ? [cx + 14 + lean, top + 5] : [grip[0] + 1, grip[1] + 1];
  const handL = spread ? [cx - 14 + lean, top + 5] : [cx - 11 + lean, top + 10];
  drawSleeve(ctx, shoulderL[0], shoulderL[1], handL[0], handL[1], -1, pose);
  drawSleeve(ctx, shoulderR[0], shoulderR[1], handR[0], handR[1], 1, pose);
}

function drawHead(ctx, cx, headY, pose) {
  const shift = pose.lean || 0;
  const hx = cx + shift;
  const y = headY + (pose.headBob || 0);
  const bowDy = (pose.bowDy || 0) + (pose.bowLift || 0);
  const blink = pose.blink;

  // Head silhouette.
  outlinedEllipse(ctx, hx, y, 10, 11, HAIR, INK);
  // Face.
  ellipse(ctx, hx, y + 4, 7, 7, SKIN);
  rect(ctx, hx - 8, y + 9, 3, 1, SKIN_SHADE);
  rect(ctx, hx + 6, y + 9, 3, 1, SKIN_SHADE);
  rect(ctx, hx - 6, y + 10, 12, 1, SKIN_SHADE);

  // Jagged fringe with a centre part.
  const fringe = [
    [-9, -7, 4, 5],
    [-5, -8, 4, 4],
    [-1, -7, 3, 6],
    [3, -8, 4, 5],
    [7, -7, 3, 5],
  ];
  for (const [x, yy, w, h] of fringe) rect(ctx, hx + x, y + yy, w, h, HAIR);
  // Long side locks.
  for (const side of [-1, 1]) {
    const lockX = hx + side * 12;
    for (let i = 0; i < 16; i++) {
      const lx = lockX - side * Math.floor(i * 0.08);
      const w = 4 - Math.floor(i / 9);
      rect(ctx, lx - 1, y + 1 + i, w + 2, 1, INK);
      rect(ctx, lx, y + 1 + i, w, 1, i > 10 ? HAIR_DARK : HAIR);
    }
    rect(ctx, lockX - side, y + 4, 2, 4, HAIR_LIGHT);
    // White hair tube, squeezed around the lower part of the lock.
    const tubeX = side < 0 ? hx - 12 : hx + 9;
    rect(ctx, tubeX, y + 11, 4, 1, INK);
    rect(ctx, tubeX, y + 12, 4, 3, TUBE);
    rect(ctx, tubeX, y + 12, 4, 1, TUBE_RED);
    rect(ctx, tubeX, y + 15, 4, 1, INK);
    rect(ctx, tubeX + 1, y + 13, 2, 1, WHITE_LIGHT);
  }

  // Hair shading and highlights.
  rect(ctx, hx - 7, y - 7, 4, 1, HAIR_LIGHT);
  rect(ctx, hx + 3, y - 8, 3, 1, HAIR_LIGHT);
  line(ctx, hx - 9, y - 4, hx - 5, y - 6, HAIR_SHINE, 1);
  line(ctx, hx + 5, y - 6, hx + 8, y - 3, HAIR_SHINE, 1);

  // Red eyes with a white catchlight.
  const eyeY = y + 3;
  for (const side of [-1, 1]) {
    const ex = hx + (side < 0 ? -6 : 3);
    if (blink) {
      rect(ctx, ex, eyeY + 2, 4, 1, INK);
      rect(ctx, ex + (side < 0 ? 0 : 3), eyeY + 2, 1, 2, INK);
    } else {
      rect(ctx, ex, eyeY, 3, 3, INK);
      rect(ctx, ex, eyeY + 1, 2, 2, EYE_RED);
      rect(ctx, ex + 2, eyeY + 1, 1, 2, EYE_DARK);
      rect(ctx, ex, eyeY + 1, 1, 1, WHITE_LIGHT);
      rect(ctx, ex, eyeY + 3, 3, 1, INK_SOFT);
      rect(ctx, ex + (side < 0 ? 0 : 1), eyeY - 2, 2, 1, HAIR_DARK);
    }
  }
  // Nose, blush, smile.
  rect(ctx, hx, y + 6, 1, 1, SKIN_SHADE);
  rect(ctx, hx - 9, y + 6, 2, 1, PINK);
  rect(ctx, hx + 7, y + 6, 2, 1, PINK);
  rect(ctx, hx - 1, y + 8, 2, 1, MOUTH);
  rect(ctx, hx - 2, y + 7, 1, 1, MOUTH);
}

function poseForFrame(frame) {
  const base = {
    arms: 'hold',
    legs: 'stand',
    skirtFlare: 0,
    skirtSway: 0,
    bowDy: 0,
    hairSway: 0,
    headBob: 0,
  };
  const poses = {
    0: { ...base, bob: 0, lean: 0, broom: { grip: [43, 39], head: [50, 56] } },
    1: { ...base, bob: -1, lean: 0, bowDy: -1, hairSway: 1, broom: { grip: [43, 38], head: [50, 55] } },
    2: { ...base, bob: 0, lean: -1, hairSway: -1, broom: { grip: [42, 40], head: [55, 57] } },
    3: { ...base, bob: 1, lean: 1, bowDy: 1, hairSway: 1, broom: { grip: [39, 41], head: [32, 57] } },
    4: { ...base, bob: 1, crouch: 1, lean: 2, skirtSway: 1, bowDy: 1, hairSway: 1, broom: { grip: [35, 42], head: [12, 57] } },
    5: { ...base, bob: 0, lean: 0, bowDy: 0, broom: { grip: [39, 41], head: [22, 57] } },
    6: { ...base, bob: 0, lean: 0, bowDy: 1, broom: { grip: [44, 39], head: [51, 56] } },
    7: {
      ...base,
      legs: 'crouch',
      bob: 2,
      crouch: 2,
      bowDy: 2,
      hairSway: -1,
      skirtFlare: 2,
      broom: { grip: [40, 43], head: [48, 56] },
    },
    8: {
      ...base,
      legs: 'tuck',
      bob: -2,
      skirtFlare: 7,
      arms: 'spread',
      bowDy: -2,
      hairSway: 2,
      broom: { grip: [41, 40], head: [57, 50], spread: 5 },
    },
    9: {
      ...base,
      legs: 'tuck',
      bob: -1,
      skirtFlare: 9,
      arms: 'spread',
      bowDy: -1,
      hairSway: 2,
      broom: { grip: [40, 42], head: [59, 54], spread: 5 },
    },
    10: {
      ...base,
      legs: 'land',
      bob: 2,
      crouch: 3,
      skirtFlare: 4,
      bowDy: 3,
      broom: { grip: [41, 44], head: [52, 57] },
    },
    11: { ...base, bob: 0, lean: 1, blink: true, broom: { grip: [43, 39], head: [50, 56] } },
  };
  return poses[frame];
}

function drawFrame(ctx, frame) {
  const pose = poseForFrame(frame);
  const cx = 32;
  const bob = pose.bob || 0;
  const crouch = pose.crouch || 0;
  const bodyY = bob + crouch;
  const headY = 21 + bodyY;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CELL, CELL);
  drawBowTails(ctx, cx, headY, pose);
  drawBackHair(ctx, cx, headY, pose);
  drawLegs(ctx, cx, pose);
  drawSkirt(ctx, cx, bodyY, pose);
  drawTorso(ctx, cx, bodyY, pose);
  drawBroom(ctx, pose);
  drawSleeves(ctx, cx, bodyY, pose);
  drawBowLoops(ctx, cx, headY, pose);
  drawHead(ctx, cx, headY, pose);
  drawBowKnot(ctx, cx, headY, pose);
  ctx.restore();
}

export function makeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = CELL * COLS;
  canvas.height = CELL * ROWS;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < COLS * ROWS; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    ctx.save();
    ctx.translate(col * CELL, row * CELL);
    ctx.beginPath();
    ctx.rect(0, 0, CELL, CELL);
    ctx.clip();
    drawFrame(ctx, i);
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1 / COLS, 1 / ROWS);
  texture.needsUpdate = true;
  return { canvas, texture };
}
