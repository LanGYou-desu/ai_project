import * as THREE from 'three';
import {
  clamp,
  easeInOutCubic,
  createSoftShadowTexture,
} from './helpers.js';
import { CELL, COLS, ROWS, makeAtlas } from './reimuArt.js';

/* ------------------------------------------------------------------ *
 * Character controller and shadow compositor.
 * The pixel-art atlas itself lives in reimuArt.js.
 * ------------------------------------------------------------------ */

function updateShadowSilhouette(ctx, atlasCanvas, frame) {
  const col = frame % COLS;
  const row = Math.floor(frame / COLS);
  const silhouette = document.createElement('canvas');
  silhouette.width = CELL;
  silhouette.height = CELL;
  const sctx = silhouette.getContext('2d');
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(atlasCanvas, col * CELL, row * CELL, CELL, CELL, 0, 0, CELL, CELL);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = '#3a343c';
  sctx.fillRect(0, 0, CELL, CELL);

  ctx.clearRect(0, 0, 128, 128);
  ctx.save();
  ctx.filter = 'blur(4px)';
  ctx.globalAlpha = 0.95;
  ctx.drawImage(silhouette, 0, 0, CELL, CELL, 12, 14, 104, 100);
  ctx.restore();
  ctx.save();
  ctx.filter = 'blur(8px)';
  ctx.globalAlpha = 0.3;
  ctx.drawImage(silhouette, 0, 0, CELL, CELL, 8, 18, 112, 92);
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * Character controller
 * ------------------------------------------------------------------ */
const SPOTS = [
  [2.8, 4.6],
  [-1.9, 5.25],
  [3.0, 6.3],
  [-3.1, 4.7],
  [-1.0, 3.5],
  [1.6, 6.4],
];

export function buildReimu(root, camera, groundHeightAt, leafSystem) {
  const atlas = makeAtlas();

  const character = new THREE.Group();
  root.add(character);

  const billboard = new THREE.Group();
  character.add(billboard);

  const flip = new THREE.Group();
  billboard.add(flip);

  const spriteHeight = 2.15;
  const material = new THREE.MeshToonMaterial({
    map: atlas.texture,
    gradientMap: makeToonGradient(),
    transparent: true,
    alphaTest: 0.34,
    side: THREE.FrontSide,
    emissive: 0x35282a,
    emissiveIntensity: 0.22,
  });
  const spriteGeometry = new THREE.PlaneGeometry(spriteHeight, spriteHeight);
  // Put the origin at the feet, not the centre of the billboard.
  spriteGeometry.translate(0, spriteHeight / 2, 0);
  const sprite = new THREE.Mesh(spriteGeometry, material);
  sprite.position.y = -0.067;
  sprite.renderOrder = 4;
  flip.add(sprite);

  // Shadow lives on the ground, independently from the jumping sprite.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const shadowCtx = shadowCanvas.getContext('2d');
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  shadowTexture.colorSpace = THREE.NoColorSpace;
  shadowTexture.minFilter = THREE.LinearFilter;
  shadowTexture.magFilter = THREE.LinearFilter;
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    toneMapped: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.35), shadowMat);
  shadow.name = 'ReimuGroundShadow';
  shadow.renderOrder = 3;
  root.add(shadow);

  // A second, very soft ambient contact blob keeps the character planted.
  const blobMat = new THREE.MeshBasicMaterial({
    map: createSoftShadowTexture(),
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    toneMapped: false,
    color: 0x3c3540,
  });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.78), blobMat);
  blob.name = 'ReimuContactShadow';
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 2;
  root.add(blob);

  const state = {
    phase: 'idle',
    phaseTime: 0,
    round: 0,
    spot: 0,
    facing: 1, // 1 = sweep toward screen-left in the art, -1 = mirrored
    sweepDir: new THREE.Vector2(-1, 0),
    sweepTime: 0,
    sweepFrameTime: 0,
    jump: {
      from: new THREE.Vector2(),
      to: new THREE.Vector2(),
      height: 0,
      airTime: 0,
      duration: 0,
    },
  };
  let x = SPOTS[0][0];
  let z = SPOTS[0][1];
  let ground = groundHeightAt(x, z);
  character.position.set(x, ground, z);

  let lastFrame = -1;
  let shadowFrame = -1;
  let leafPushTimer = 0;
  let idleFrameTimer = 0;
  let idleFrame = 0;
  let blinkTimer = 0;
  let blink = false;

  const tmpRight = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  const groundRotation = new THREE.Quaternion();
  const tiltRotation = new THREE.Quaternion();

  function currentCameraRight() {
    tmpRight.setFromMatrixColumn(camera.matrixWorld, 0);
    tmpRight.y = 0;
    if (tmpRight.lengthSq() < 0.0001) tmpRight.set(1, 0, 0);
    return tmpRight.normalize();
  }

  function setFrame(frame, force = false) {
    if (!force && frame === lastFrame) return;
    lastFrame = frame;
    const col = frame % COLS;
    const row = Math.floor(frame / COLS);
    atlas.texture.offset.set(col / COLS, 1 - (row + 1) / ROWS);
    if (frame !== shadowFrame) {
      shadowFrame = frame;
      updateShadowSilhouette(shadowCtx, atlas.canvas, frame);
      shadowTexture.needsUpdate = true;
    }
  }

  function updateShadow(jumpHeight) {
    const k = clamp(jumpHeight / 1.15, 0, 1);
    const sx = 1 + k * 0.42;
    const sz = 1 + k * 0.3;
    // Sunlight comes from the front-left, so the silhouette falls back-right.
    const dirX = 0.67;
    const dirZ = -0.74;
    shadow.position.set(
      x + dirX * 0.45,
      groundHeightAt(x, z) + 0.022,
      z + dirZ * 0.45,
    );
    blob.position.set(x + 0.07, groundHeightAt(x, z) + 0.015, z + 0.1);
    shadow.scale.set(sx, sz, 1);
    blob.scale.setScalar(1 + k * 0.5);
    shadowMat.opacity = 0.62 * (1 - k * 0.3);
    blobMat.opacity = 0.3 * (1 - k * 0.22);
    // Lay the silhouette on the ground, with her head pointing away from the
    // sun. A billboard sprite can't cast a perfect realtime shadow, so this
    // gives a deliberately soft, hand-drawn substitute.
    const yaw = Math.atan2(-dirX, -dirZ);
    groundRotation.setFromAxisAngle(Y_AXIS, yaw);
    tiltRotation.setFromAxisAngle(X_AXIS, -Math.PI / 2);
    shadow.quaternion.copy(groundRotation).multiply(tiltRotation);
  }

  function chooseNextSpot() {
    let next = state.spot;
    for (let i = 0; i < 5; i++) {
      next = (next + 2 + Math.floor(Math.random() * (SPOTS.length - 1))) % SPOTS.length;
      if (next !== state.spot) break;
    }
    state.spot = next;
    return new THREE.Vector2(SPOTS[next][0], SPOTS[next][1]);
  }

  function beginJump() {
    state.phase = 'jumpPrep';
    state.phaseTime = 0;
    setFrame(7);
    const target = chooseNextSpot();
    state.jump.from.set(x, z);
    state.jump.to.copy(target);
    state.jump.height = 0;
  }

  function beginAir() {
    state.phase = 'jumpAir';
    state.phaseTime = 0;
    state.jump.airTime = 0;
    const dist = state.jump.from.distanceTo(state.jump.to);
    state.jump.duration = 0.72 + clamp(dist * 0.035, 0, 0.16);
  }

  function endJump() {
    state.phase = 'land';
    state.phaseTime = 0;
    state.round = 0;
    setFrame(10);
  }

  function startPause(duration) {
    state.phase = 'pause';
    state.phaseTime = 0;
    state.pauseDuration = duration;
    setFrame(6);
  }

  function startSweep() {
    state.phase = 'sweep';
    state.phaseTime = 0;
    state.sweepTime = 0;
    state.sweepFrameTime = 0;
    state.sweepDir.copy(currentCameraRight()).multiplyScalar(-state.facing);
    setFrame(2);
    leafPushTimer = 0;
  }

  // Put the pixel Reimu on her feet at the very first frame.
  setFrame(0, true);
  updateShadow(0);

  function update(t, dt) {
    state.phaseTime += dt;
    const camRight = currentCameraRight();
    state.sweepDir.copy(camRight).multiplyScalar(-state.facing);

    // Billboard always presents the clean 2D silhouette to the viewer.
    toCamera.set(camera.position.x - x, 0, camera.position.z - z);
    billboard.rotation.y = Math.atan2(toCamera.x, toCamera.z);

    let jumpHeight = 0;
    let visualLean = 0;
    let squash = 1;

    switch (state.phase) {
      case 'idle': {
        // A first, quiet breath before she starts work.
        if (state.phaseTime > 1.2) startSweep();
        break;
      }
      case 'sweep': {
        state.sweepTime += dt;
        state.sweepFrameTime += dt;
        if (state.sweepFrameTime > 0.22) {
          state.sweepFrameTime = 0;
          const frames = [2, 3, 4, 5];
          const idx = frames.indexOf(lastFrame);
          setFrame(frames[(idx + 1 + frames.length) % frames.length]);
        }
        visualLean = Math.sin(state.sweepTime * 6.4) * 0.012;
        // The broom actually nudges the leaf piles on the stroke.
        leafPushTimer -= dt;
        if (leafPushTimer <= 0) {
          leafPushTimer = 0.16;
          const reach = 0.95;
          const tipX = x + state.sweepDir.x * reach;
          const tipZ = z + state.sweepDir.y * reach;
          leafSystem.pushAt(tipX, tipZ, state.sweepDir.x, state.sweepDir.y, 1.0);
        }
        if (state.sweepTime > 2.55) {
          state.round += 1;
          state.facing *= -1;
          startPause(0.78);
        }
        break;
      }
      case 'pause': {
        // A tiny breathe, and then another three rounds before the hop.
        setFrame(6);
        if (state.phaseTime > 0.22) {
          const breathe = Math.sin((state.phaseTime - 0.22) * 2.4) * 0.004;
          visualLean = breathe;
        }
        if (state.phaseTime > (state.pauseDuration ?? 0.78)) {
          if (state.round > 0 && state.round % 3 === 0) beginJump();
          else startSweep();
        }
        break;
      }
      case 'jumpPrep': {
        setFrame(7);
        squash = 1 - Math.min(0.05, state.phaseTime * 0.16);
        if (state.phaseTime > 0.38) beginAir();
        break;
      }
      case 'jumpAir': {
        state.jump.airTime += dt;
        const p = clamp(state.jump.airTime / state.jump.duration, 0, 1);
        const e = easeInOutCubic(p);
        x = state.jump.from.x + (state.jump.to.x - state.jump.from.x) * e;
        z = state.jump.from.y + (state.jump.to.y - state.jump.from.y) * e;
        ground = groundHeightAt(x, z);
        const peak = 0.92 + state.jump.from.distanceTo(state.jump.to) * 0.08;
        jumpHeight = Math.sin(Math.PI * p) * peak;
        character.position.set(x, ground + jumpHeight, z);
        setFrame(p < 0.58 ? 8 : 9);
        // Squash and stretch around the feet.
        squash = 1 + Math.sin(Math.PI * p) * 0.035;
        visualLean = Math.sin(p * Math.PI * 2) * 0.025;
        if (p >= 1) {
          character.position.set(x, ground, z);
          endJump();
        }
        break;
      }
      case 'land': {
        setFrame(10);
        const p = clamp(state.phaseTime / 0.32, 0, 1);
        squash = 1 - Math.sin(Math.PI * p) * 0.035;
        if (p >= 1) startPause(0.62);
        break;
      }
      default:
        break;
    }

    // If we are not in the air, the foot stays exactly on the paving height.
    if (state.phase !== 'jumpAir') {
      ground = groundHeightAt(x, z);
      character.position.set(x, ground, z);
    }

    // Very slight billboard-scale breathing, with all animation anchored at
    // the feet. Skirt and bow motion is baked into the pixel frames.
    const breath = Math.sin(t * 1.9) * 0.0045 + Math.sin(t * 0.61) * 0.0025;
    const idleBob =
      state.phase === 'pause' || state.phase === 'idle'
        ? breath
        : state.phase === 'jumpAir' || state.phase === 'land'
          ? 0
          : breath * 0.35;
    sprite.scale.set(state.facing, squash + idleBob, 1);
    sprite.rotation.z = visualLean;

    // Tiny idle frame cadence and an occasional blink.
    if (state.phase === 'idle' || state.phase === 'pause') {
      idleFrameTimer += dt;
      blinkTimer += dt;
      if (idleFrameTimer > 1.0) {
        idleFrameTimer = 0;
        if (state.phase === 'pause') setFrame(6);
        else {
          idleFrame = idleFrame === 0 ? 1 : 0;
          setFrame(blink ? 11 : idleFrame);
        }
      }
      if (blinkTimer > 3.7) {
        blinkTimer = 0;
        blink = !blink;
        if (state.phase === 'idle') setFrame(blink ? 11 : idleFrame);
      }
    } else {
      blink = false;
    }

    updateShadow(state.phase === 'jumpAir' ? jumpHeight : 0);
    // The shadow should soften, not disappear, when the camera is low.
    const camDistance = camera.position.distanceTo(character.position);
    sprite.visible = camDistance < 60;
  }

  return {
    update,
    character,
    sprite,
    material,
    atlas,
    get position() {
      return character.position;
    },
    getState() {
      return {
        phase: state.phase,
        round: state.round,
        facing: state.facing,
        x,
        z,
        ground,
        frame: lastFrame,
      };
    },
  };
}

let cachedGradient;
function makeToonGradient() {
  if (cachedGradient) return cachedGradient;
  const data = new Uint8Array([110, 165, 215, 255]);
  cachedGradient = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  cachedGradient.minFilter = THREE.NearestFilter;
  cachedGradient.magFilter = THREE.NearestFilter;
  cachedGradient.generateMipmaps = false;
  cachedGradient.needsUpdate = true;
  return cachedGradient;
}
