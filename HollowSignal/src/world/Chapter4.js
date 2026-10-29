import * as THREE from 'three';
import { BaseLevel } from './BaseLevel.js';
import {
  addChair, addCrate, addCabinet, addPipeRun, addRubble, addBarrel,
  makeCassetteMesh, makeTapePlayer
} from './Props.js';
import {
  placeNote, addCeilingLamp, addRailing, addWaterSheen
} from './ChapterKit.js';
import { FINAL_TAPE, getRecord } from '../story/content.js';
import { dressChapter4 } from './Dressing.js';

/**
 * CHAPTER IV — THE HOLLOW
 * A corridor of closed memory, the resonance gallery, and the last tape.
 * There is no chase here. The only thing following Iris is the decision.
 */
export class Chapter4 extends BaseLevel {
  constructor(game, meta) {
    super(game, meta);
    this.id = 'hollow';
    this.ambientTrack = 'hollow';
    this.spawn = { x: 0, z: 14.2, yaw: 0, pitch: -.02 };
    this.showNoise = false;
    this.allowHiding = false;
    this.inGallery = false;
    this.tapeStarted = false;
    this.choiceMade = null;
    this._leaving = false;
    this._arrayLight = null;
    this._arrayGlow = null;
    this._consoleScreen = null;
    this._consoleLight = null;
    this._arrayRings = [];
    this._arrayNodes = [];
    this._arrayCore = null;
    this._arrayPulse = 0;
    this._consoleItem = null;
    this._cassette = null;
    this._memoryTriggered = new Set();
  }

  async build() {
    this.setAtmosphere({
      color: 0x020403,
      fogColor: 0x040706,
      fogDensity: .036
    });

    /* ---------------- Memory corridor ---------------- */
    this.addFloor(-1.65, 1.65, 2, 15, 'metalFloorDark', 0, .22, { surface: 'metal' });
    this.addCeiling(-1.65, 1.65, 2, 15, 'ceiling', 2.9);
    this.addWallZ(2, 15, -1.65, 2.9, 'concreteDark');
    this.addWallZ(2, 15, 1.65, 2.9, 'concreteDark');
    this.addWallX(-1.65, 1.65, 15, 2.9, 'concreteDark');
    this.addWallX(-9, 9, 2, 5.4, 'concreteDark', {
      openings: [{ x0: -1.65, x1: 1.65, height: 2.62 }]
    });
    this.addDoorFrame('x', 0, 2, 3.3, 2.55, 'paintedMetalDark');

    this.addSign({
      x: 0, y: 2.68, z: 2.1, width: 1.35, height: .31,
      key: 'gallery-threshold-sign', title: '共振展厅',
      lines: ['仅限授权人员 · 晶格 01'], titleSize: 31
    });

    addPipeRun(this, [[-1.42, 2.66, 14.7], [-1.42, 2.66, 2.2]], { radius: .055, material: 'pipeGreen' });
    addPipeRun(this, [[1.42, 2.57, 14.7], [1.42, 2.57, 2.2]], { radius: .035, material: 'steelDull' });
    this.addStaticBox('warningYellow', 2.95, .026, .065, 0, 2.78, 4.2, { scale: .7 });
    this.addStaticBox('warningYellow', 2.95, .026, .065, 0, 2.78, 11.2, { scale: .7 });
    this.addStaticBox('blackMetal', .62, .022, 12.7, 0, .012, 8.5, { scale: 1.1 });

    // Four doors that are only shapes now. The corridor remembers the rooms.
    this._buildMemoryDoor(1, 10.45, 'M-03', '我曾在这里');
    this._buildMemoryDoor(-1, 8.25, 'M-07', '不要打开');
    this._buildMemoryDoor(1, 6.05, 'M-12', '1996年3月17日');
    this._buildMemoryDoor(-1, 4.1, 'M-00', '下面的房间');

    // Iris's unsent letter, left in the coat she wore to the inquiry.
    this.addStaticBox('fabricDark', .08, .86, .48, -1.55, 1.27, 12.55, { scale: 1.2 });
    this.addStaticBox('steelDull', .035, .035, .1, -1.56, 1.72, 12.55, { scale: .4 });
    this.addStaticBox('steelDull', .5, .04, .38, -1.38, .88, 12.55, { scale: .6 });
    this.addStaticBox('darkMetal', .05, .88, .05, -1.58, .44, 12.55, { scale: .5 });
    placeNote(this, 'iris-letter', -1.47, 1.35, 12.55, {
      ry: Math.PI / 2, rx: 0, width: .24, height: .32,
      label: '阅读外套口袋里的信', pin: false
    });
    this.addBakeLight(-1.2, 2.35, 12.5, { color: 0xffc28c, intensity: .54, range: 4.4 });

    /* ---------------- Gallery shell ---------------- */
    this.addFloor(-9, 9, -11, 2, 'concreteFloorDark', 0, .27, { surface: 'concrete' });
    this.addCeiling(-9, 9, -11, 2, 'ceiling', 5.35);
    this.addWallZ(-11, 2, -9, 5.4, 'concreteDark');
    this.addWallZ(-11, 2, 9, 5.4, 'concreteDark');
    this.addWallX(-9, 9, -11, 5.4, 'concreteDark', {
      openings: [{ x0: -2.6, x1: 2.6, height: 3.55 }]
    });

    // Rear service door: a blind black mouth, never reachable in this chapter.
    this.addStaticBox('blackHole', 4.9, 3.25, .12, 0, 1.65, -10.88, { scale: 1 });
    this.addStaticBox('steelDull', .2, 3.55, .28, -2.6, 1.78, -10.82, { scale: 1 });
    this.addStaticBox('steelDull', .2, 3.55, .28, 2.6, 1.78, -10.82, { scale: 1 });
    this.addStaticBox('steelDull', 5.4, .2, .28, 0, 3.5, -10.82, { scale: 1 });
    this.addSign({
      x: 0, y: 3.08, z: -10.72, width: 1.25, height: .28,
      key: 'gallery-lattice-sign', title: '晶格控制室',
      lines: ['共振舱 · 1996年封闭'], titleSize: 30, glowing: true
    });

    for (const [x, z] of [[-6.5, -3.1], [6.5, -3.1], [-6.5, -8.2], [6.5, -8.2]]) {
      this.addWallBox('concrete', .62, 5.4, .62, x, 2.7, z);
      this.addStaticBox('warningYellow', .66, .07, .66, x, 3.82, z, { scale: .8 });
      this.addStaticBox('rustPaint', .7, .16, .7, x, .08, z, { scale: 1 });
    }

    addPipeRun(this, [[-8.72, 4.72, 1.6], [-8.72, 4.72, -10.7]], { radius: .17, material: 'pipeRust' });
    addPipeRun(this, [[8.72, 4.5, 1.6], [8.72, 4.5, -10.7]], { radius: .1, material: 'pipeGreen' });
    addPipeRun(this, [[-8.7, 4.3, -2.0], [-4.6, 4.3, -2.0], [-4.6, 4.9, -7.1], [0, 4.9, -7.1]], { radius: .06, material: 'steelDull' });
    addPipeRun(this, [[8.7, 4.28, -8.0], [5.0, 4.28, -8.0], [5.0, 4.75, -7.1], [0, 4.75, -7.1]], { radius: .055, material: 'steelDull' });
    for (let z = 1; z > -10.5; z -= 2.65) {
      this.addStaticBox('steelDull', 17.2, .055, .08, 0, 4.95, z, { scale: 1.15 });
    }

    // Raised cable gutter and wet floor markers.
    this.addStaticBox('blackMetal', .5, .12, 12.3, -3.05, .06, -4.4, { scale: 1.1 });
    this.addStaticBox('warningYellow', 12.4, .014, .08, 0, .018, 1.2, { scale: .7 });
    this.addStaticBox('warningYellow', .08, .014, 9.5, -2.4, .018, -4.2, { scale: .7 });
    this.addStaticBox('warningYellow', .08, .014, 9.5, 2.4, .018, -4.2, { scale: .7 });

    /* ---------------- The resonance array ---------------- */
    this._buildArray();

    /* ---------------- Final console ---------------- */
    this._buildConsole();

    /* ---------------- Incident report lectern ---------------- */
    this.addStaticBox('darkMetal', .58, .86, .5, -5.15, .43, -4.2, { scale: 1.2 });
    this.addStaticBox('steelDull', .7, .065, .62, -5.15, .88, -4.2, { scale: 1 });
    this.addStaticBox('blackMetal', .07, .88, .07, -5.15, .44, -4.2, { scale: .5 });
    this.addCollider(-5.5, -4.8, 0, 1.0, -4.55, -3.85, { occluder: false, bakeOccluder: false });
    placeNote(this, 'incident-final', -5.15, .93, -4.2, {
      rx: -Math.PI / 2, width: .3, height: .4,
      label: '阅读密封的事故附录'
    });
    this.addBakeLight(-5.2, 2.05, -4.4, { color: 0xd6c596, intensity: .72, range: 4.6 });
    this.addSign({
      x: -5.15, y: 2.2, z: -4.9, width: .9, height: .26,
      key: 'incident-lectern-sign', title: '0317号事故',
      lines: ['附录 · 法律封存'], titleSize: 30
    });

    dressChapter4(this);

    /* ---------------- Side dressing ---------------- */
    addChair(this, -4.8, -2.4, { rotation: Math.PI * .45 });
    addChair(this, 4.8, -2.4, { rotation: -Math.PI * .45 });
    addCabinet(this, -8.52, -1.0, { rotation: Math.PI / 2 });
    addCabinet(this, 8.52, -7.8, { rotation: -Math.PI / 2 });
    addCrate(this, -7.2, -9.4, { size: .65, rotation: .18 });
    addCrate(this, -6.55, -9.55, { size: .48, rotation: -.2 });
    addCrate(this, 7.35, 0.1, { size: .58, rotation: .25 });
    addBarrel(this, 7.35, -9.7, { height: .95, radius: .29 });
    addRubble(this, -3.8, -9.6, .8, 5);
    addRubble(this, 4.9, 1.0, .55, 4);

    this.addPuddle(-1.1, -5.4, 3.5, 3.2, { opacity: .36 });
    this.addPuddle(3.7, -8.8, 2.4, 2.2, { opacity: .32 });
    this.addPuddle(.3, -2.15, 1.5, 1.2, { opacity: .3 });
    this.addPuddle(.5, 9.5, 1.4, 2.8, { opacity: .38 });
    addWaterSheen(this, -2.8, 2.8, -9.65, -4.3, { y: .014, opacity: .2, color: 0x23322d });
    this.addDecal('water', 0, 4.1, -10.87, 5.2, 2.5);
    this.addDecal('water', -8.87, 2.1, -2.8, 4.0, 2.4, { rx: 0, ry: Math.PI / 2 });
    this.addDecal('grime', -1.64, 1.3, 9.1, 2.2, 1.8, { rx: 0, ry: Math.PI / 2 });
    this.addDecal('hand', 1.63, 1.44, 5.0, .72, .72, { rx: 0, ry: -Math.PI / 2 });
    this.addDecal('foot', -.2, .012, -1.2, .7, 1.08, { rx: -Math.PI / 2, ry: .12 });
    this.addDecal('foot', .18, .012, -1.8, .7, 1.08, { rx: -Math.PI / 2, ry: .04 });

    // A low rail separates the console from the array's wet apron.
    addRailing(this, -2.2, 2.2, -3.35, { height: 1.02, posts: 5 });
    this.addCollider(-2.2, 2.2, 0, 1.05, -3.45, -3.25, { occluder: false, bakeOccluder: false });

    /* ---------------- Lighting ---------------- */
    addCeilingLamp(this, 0, 12.7, { y: 2.78, length: 1.35, intensity: .9, range: 7.0, flicker: true });
    addCeilingLamp(this, 0, 8.9, { y: 2.78, length: 1.25, intensity: .58, range: 6.2 });
    addCeilingLamp(this, 0, 5.2, { y: 2.78, length: 1.2, intensity: .72, range: 6.4, flicker: true });
    this.addBakeLight(0, 2.35, 2.9, { color: 0xaec5b2, intensity: .46, range: 4.8 });
    this.addBakeLight(-1.35, 1.65, 12.55, { color: 0xffbf8b, intensity: .26, range: 3.1 });

    addCeilingLamp(this, -6.3, -4.1, { y: 5.0, length: 1.7, color: 0xbad3c0, intensity: 1.05, range: 9.5, flicker: true });
    addCeilingLamp(this, 6.3, -4.1, { y: 5.0, length: 1.7, color: 0xbad3c0, intensity: .95, range: 9.0 });
    addCeilingLamp(this, -6.3, -9.2, { y: 5.0, length: 1.35, color: 0xffc491, intensity: .55, range: 7.0 });
    addCeilingLamp(this, 6.3, -9.2, { y: 5.0, length: 1.35, color: 0xffc491, intensity: .55, range: 7.0 });
    this.addBakeLight(-6.7, 4.8, 0.4, { color: 0x8da99b, intensity: .52, range: 7.0 });
    this.addBakeLight(6.7, 4.8, 0.4, { color: 0x8da99b, intensity: .48, range: 7.0 });
    this.addBakeLight(0, 2.65, 0.5, { color: 0xffc28c, intensity: .72, range: 6.5 });

    this._arrayLight = this.addDynamicPointLight(0, 2.35, -7.05, {
      color: 0x8bbda3, intensity: 3.1, distance: 13, decay: 1.5
    });
    this.addFlicker(this._arrayLight, null, { baseIntensity: 3.1, baseEmissive: 0 });
    this._consoleLight = this.addDynamicPointLight(0, 1.5, -0.7, {
      color: 0xffc38d, intensity: 1.25, distance: 5.0, decay: 1.7
    });

    addCeilingLamp(this, 0, 2.9, { y: 5.0, length: 1.5, color: 0x9ec1ae, intensity: .72, range: 8, lit: true });

    /* ---------------- Acoustic dressing ---------------- */
    this.addSoundEmitter(0, 2.2, -7.1, { sound: 'metalGroan', min: 10, max: 19, volume: .13, rateMin: .3, rateMax: .44, maxDistance: 18 });
    this.addSoundEmitter(-2.1, .2, -5.9, { sound: 'drip', min: 3, max: 8, volume: .16, maxDistance: 13 });
    this.addSoundEmitter(5.5, .2, -9.4, { sound: 'drip', min: 6, max: 12, volume: .11, maxDistance: 12 });
    this.addSoundEmitter(-1.1, 1.2, 9.0, { sound: 'metalGroan', min: 16, max: 30, volume: .07, rateMin: .37, rateMax: .55, maxDistance: 14 });
    this.addDustVolume(-8.7, 8.7, -10.7, 1.8, .35, 4.9);
    this.addDustVolume(-1.5, 1.5, 2.1, 14.8, .25, 2.7);

    /* ---------------- Story beats ---------------- */
    this.objective = {
      text: '沿记忆走廊前往共振展厅。',
      sub: '最终磁带正在阵列能听见的地方等着。'
    };

    this.addTrigger({
      x0: -1.6, x1: 1.6, z0: 10.7, z1: 11.9, once: true,
      onEnter: () => {
        this.game.audio.whisper(3.8, .13);
        this.game.ui.say('蕾恩·维尔', '艾瑞斯？灯要灭了。', 3.8);
        this.game.audio.setTension(.22);
        this.setCheckpoint(0, 12.9, 0);
      }
    });
    this.addTrigger({
      x0: -1.6, x1: 1.6, z0: 5.9, z1: 7.0, once: true,
      onEnter: () => {
        this.game.audio.play('staticBurst', { volume: .08, rate: .45 });
        this.game.ui.say('信号', '你快到那个把我留下的房间了。', 4.1);
        this.game.audio.setTension(.38);
        this.game.player.addShake(.13);
      }
    });
    this.addTrigger({
      x0: -1.65, x1: 1.65, z0: 2.0, z1: 3.2, once: true,
      onEnter: () => {
        this.inGallery = true;
        this.game.audio.play('metalGroan', { volume: .16, rate: .42 });
        this.game.audio.whisper(4.4, .12);
        this.game.ui.showHint('展厅醒着。阵列等了八年，等一个人坐到控制台前。', 5.2);
        this.game.audio.setTension(.3);
        this.setCheckpoint(0, 1.5, 0);
        this._refreshObjective();
      }
    });
    this.addTrigger({
      x0: -3.8, x1: 3.8, z0: -9.8, z1: -3.6, once: true,
      onEnter: () => {
        this.game.ui.say('信号', '叫我的名字。像门关上之前那样叫。', 4.6);
        this.game.audio.whisper(4.0, .16);
        this.game.ui.showHint('圆环正逆着水流转动。控制台上有一盘磁带。', 4.2);
        this.game.audio.setTension(.55);
        this.game.player.addShake(.2);
      }
    });
    this.addTrigger({
      x0: -1.3, x1: 1.3, z0: -2.0, z1: -0.5, once: true,
      onEnter: () => {
        this.game.ui.showHint('控制台是温的。磁带机已经穿好带。', 3.6);
        this.game.audio.play('phoneRing', { volume: .035, rate: .5 });
        this.setCheckpoint(0, 0.9, 0);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Construction helpers                                                */
  /* ------------------------------------------------------------------ */

  _buildMemoryDoor(side, z, tag, title) {
    const x = side * 1.63;
    const inward = -side;
    this.addStaticBox('blackHole', .055, 2.02, .92, x, 1.04, z, { scale: 1 });
    this.addStaticBox('paintedMetalDark', .08, 2.22, .12, x, 1.1, z - .55, { scale: .8 });
    this.addStaticBox('paintedMetalDark', .08, 2.22, .12, x, 1.1, z + .55, { scale: .8 });
    this.addStaticBox('paintedMetalDark', .09, .13, 1.16, x, 2.16, z, { scale: .8 });
    this.addStaticBox('warningYellow', .02, .035, .72, x + inward * .045, .035, z, { scale: .5 });
    this.addStaticBox('steelDull', .04, .1, .16, x + inward * .05, 1.02, z + .34, { scale: .4 });
    // A thin seam of warm light under each door.
    this.addStaticBox('emissiveWarm', .015, .018, .78, x + inward * .035, .012, z, { scale: .3 });
    this.addSign({
      x: x + inward * .05, y: 2.43, z, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2,
      width: .42, height: .2, key: `memory-door-${z}`, title: tag, lines: [title], titleSize: 32
    });
  }

  _buildArray() {
    // The machine itself is deliberately geometric: concentric rings, a dry
    // spindle, and too many cables. It should look engineered, not supernatural.
    this.addStaticCylinder('blackMetal', 2.45, 2.62, .18, 0, .09, -7.05, { segments: 40 });
    this.addStaticCylinder('steelDull', .22, .28, 4.6, 0, 2.38, -7.05, { segments: 16 });
    this.addStaticCylinder('paintedMetalDark', 1.12, 1.3, .34, 0, .35, -7.05, { segments: 28 });
    this.addStaticBox('warningYellow', 3.1, .06, .1, 0, .22, -4.55, { scale: .6 });
    this.addCollider(-2.62, 2.62, 0, 1.2, -9.67, -4.43, { occluder: false, bakeOccluder: false });

    const group = new THREE.Group();
    group.position.set(0, 0, -7.05);
    const specs = [
      { radius: 1.05, y: 1.38, tube: .028, color: 0x8ed2b2, intensity: 1.1, rot: .2, speed: .13 },
      { radius: 1.55, y: 2.08, tube: .033, color: 0xd4b77b, intensity: .92, rot: -.45, speed: -.09 },
      { radius: 2.02, y: 2.86, tube: .042, color: 0x7fb99f, intensity: 1.22, rot: .8, speed: .055 },
      { radius: 2.34, y: 3.55, tube: .028, color: 0xb99c70, intensity: .75, rot: -.9, speed: -.03 }
    ];
    this._ringMaterials = [];
    for (const spec of specs) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x39433c,
        emissive: spec.color,
        emissiveIntensity: spec.intensity,
        roughness: .38,
        metalness: .72,
        envMapIntensity: .7
      });
      mat.userData.disposeWithObject = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(spec.radius, spec.tube, 9, 64), mat);
      ring.position.y = spec.y;
      ring.rotation.x = spec.rot;
      ring.rotation.z = spec.rot * .5;
      ring.castShadow = true;
      group.add(ring);
      this._arrayRings.push({ mesh: ring, speed: spec.speed, base: ring.rotation.y, tilt: spec.rot });
      this._ringMaterials.push(mat);
    }

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x5a665c,
      emissive: 0xb9e0c7,
      emissiveIntensity: 1.8,
      roughness: .24,
      metalness: .1
    });
    coreMat.userData.disposeWithObject = true;
    this._arrayCore = new THREE.Mesh(new THREE.SphereGeometry(.17, 18, 12), coreMat);
    this._arrayCore.position.y = 2.38;
    group.add(this._arrayCore);
    this._coreMaterial = coreMat;

    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0x645d45,
      emissive: 0xd8c58d,
      emissiveIntensity: 1.3,
      roughness: .32,
      metalness: .4
    });
    nodeMat.userData.disposeWithObject = true;
    for (let i = 0; i < 18; i++) {
      const ring = specs[i % specs.length];
      const a = (i / 18) * Math.PI * 2;
      const node = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), nodeMat);
      node.position.set(Math.cos(a) * ring.radius, ring.y + Math.sin(a * 3) * .08, Math.sin(a) * ring.radius);
      group.add(node);
      this._arrayNodes.push({ mesh: node, phase: a, radius: ring.radius, baseY: ring.y });
    }
    this.scene.add(group);
    this._arrayGroup = group;

    // Cables hang from the gallery ceiling into the crown of the machine.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + .2;
      const r = 1.7 + (i % 2) * .45;
      addPipeRun(this, [
        [Math.cos(a) * r, 5.3, -7.05 + Math.sin(a) * r],
        [Math.cos(a) * r * .72, 4.2, -7.05 + Math.sin(a) * r * .72],
        [Math.cos(a) * .22, 3.72, -7.05 + Math.sin(a) * .22]
      ], { radius: .014, material: 'rubber' });
    }

    this._arrayGlow = this.addLightCone(0, 4.9, -7.05, { color: 0xa9cfb8, radius: .8, length: 3.9, opacity: .022 });
    this._arrayGlow2 = this.addLightCone(0, 4.9, -7.05, { color: 0xd9c08c, radius: 1.6, length: 5.0, opacity: .012 });
  }

  _buildConsole() {
    const base = this.game.materials.get('paintedMetalDark');
    this.addStaticBox('paintedMetalDark', 1.3, .88, .7, 0, .44, -1.32, { scale: 1.3 });
    this.addStaticBox('steelDull', 1.46, .07, .82, 0, .91, -1.32, { scale: 1.2 });
    this.addStaticBox('blackMetal', .64, .08, .48, -.28, .98, -1.28, { scale: .9 });
    this.addStaticBox('warningYellow', 1.22, .035, .05, 0, .78, -.94, { scale: .5 });
    this.addCollider(-.7, .7, 0, 1.0, -1.72, -.92, { occluder: false, bakeOccluder: false });

    const player = makeTapePlayer(this, -.32, .98, -1.3, { rotation: .06 });
    this._cassette = makeCassetteMesh(this, .03, 1.02, -1.3, { rotation: -.16 });
    this.addStaticBox('darkMetal', .5, .4, .35, .43, 1.15, -1.4, { scale: .8 });
    this.addStaticBox('blackGloss', .4, .27, .02, .43, 1.17, -1.215, { scale: .5 });
    const screenMat = this.game.materials.glowingSignMaterial('final-console-screen', {
      title: '共振晶格',
      lines: ['磁带 09 / 已排队', '输入：开启'],
      titleSize: 35,
      lineSize: 20,
      bg: '#17221a',
      fg: '#b7d6c2',
      accent: '#cfb47b',
      width: 512,
      height: 300
    });
    this._consoleScreen = new THREE.Mesh(new THREE.PlaneGeometry(.38, .23), screenMat);
    this._consoleScreen.position.set(.43, 1.17, -1.202);
    this.scene.add(this._consoleScreen);

    for (let i = 0; i < 5; i++) {
      this.addStaticBox(i === 1 ? 'emissiveRed' : 'steelDull', .065, .022, .04, -.05 + i * .085, .965, -.89, { scale: .4 });
    }
    addPipeRun(this, [[.56, .9, -1.55], [.56, .42, -1.55], [.56, .11, -2.15]], { radius: .025, material: 'rubber' });
    addPipeRun(this, [[-.55, .9, -1.55], [-.55, .5, -1.6], [-.55, .13, -2.35]], { radius: .02, material: 'rubber' });
    this.addStaticBox('paper', .24, .006, .32, .25, .948, -1.06, { scale: .4, ry: -.12 });
    this.addStaticBox('ceramic', .09, .09, .09, -.53, .995, -1.15, { scale: .5 });

    this._consoleItem = this.addInteractable({
      position: new THREE.Vector3(0, 1.12, -.8),
      size: new THREE.Vector3(1.3, 1.05, .65),
      range: 2.35,
      label: () => {
        if (this.tapeStarted) return '最终磁带——播放中';
        if (!this.game.hasRecord('wren-final')) return '查看最终磁带';
        return '开始最终播放';
      },
      sub: () => {
        if (this.tapeStarted) return '';
        if (!this.game.hasRecord('wren-final')) return 'E — 磁带 09 / 蕾恩·维尔';
        return 'E — 播放她最后的录音';
      },
      onInteract: () => this._useConsole()
    });
    this._consoleScreen.userData.console = true;
    player.userData.console = true;
    base.name = 'final-console';
  }

  /* ------------------------------------------------------------------ */
  /* Console / ending flow                                               */
  /* ------------------------------------------------------------------ */

  _useConsole() {
    if (this.tapeStarted || this.choiceMade || this._leaving) return;
    const record = getRecord('wren-final');
    if (!this.game.hasRecord('wren-final')) {
      this.game.collectRecord(record);
      this.game.openNote(record);
      this.game.ui.showHint('磁带上写着蕾恩的字。控制台要你先听完，再做决定。', 4.2);
      this.game.audio.play('pickup', { volume: .16, rate: .8 });
      this.setCheckpoint(0, .9, 0);
      this._refreshObjective();
      return;
    }
    this._startFinalTape();
  }

  _startFinalTape() {
    if (this.tapeStarted || this.choiceMade) return;
    this.tapeStarted = true;
    this.inGallery = true;
    this._consoleItem.setEnabled(false);
    this.game.audio.play('tapeStop', { volume: .22, rate: .62 });
    this.game.audio.play('staticBurst', { volume: .1, rate: .32 });
    this.game.audio.setTension(.72);
    this.game.ui.showTape('最终播放 · 磁带 09');
    this.game.ui.showHint('磁带机吞下卡带。阵列转向声音的方向。', 4);
    this.game.audio.play('metalGroan', { volume: .14, rate: .3 });
    this.game.player.addShake(.25);
    this.setCheckpoint(0, .7, 0);
    this._refreshObjective();
    this._consoleLight.intensity = 2.1;

    const scale = .68;
    for (const line of FINAL_TAPE) {
      const at = line.at * scale;
      const duration = Math.max(2.2, line.duration * scale);
      this.after(at, () => {
        if (this.choiceMade || this._leaving) return;
        const rate = line.speaker === '艾瑞斯' ? .74 : line.speaker === '信号' ? .48 : .62;
        this.game.audio.play('staticBurst', { volume: line.speaker === '信号' ? .16 : .055, rate });
        if (line.speaker === '信号') {
          this.game.audio.tone({ frequency: 43, duration: 1.8, volume: .045, type: 'sawtooth' });
          this.game.player.addShake(.4);
        }
        this.game.ui.say(line.speaker, line.text, duration);
      });
    }
    const last = FINAL_TAPE[FINAL_TAPE.length - 1];
    const finishAt = (last.at + last.duration) * scale + .45;
    this.after(finishAt, () => {
      if (this.choiceMade || this._leaving) return;
      this.game.ui.hideTape();
      this.game.ui.showHint('磁带到了尽头，却还在转。仍有一根电缆向展厅供电。', 3.6);
      this._refreshObjective();
      this.game.audio.setTension(.8);
      this.game.openFinalChoice();
    });
  }

  _refreshObjective() {
    if (this._leaving) return;
    if (this.choiceMade) {
      this.setObjective('选择已经做出。', '没有信号需要回答了。');
      return;
    }
    if (this.tapeStarted) {
      this.setObjective('听完最终磁带。', '控制台还在运行。在听完一切之前，不要回答它。');
      return;
    }
    if (this.game.hasRecord('wren-final')) {
      this.setObjective('在控制台开始最终播放。', '一根电缆向展厅供电。磁带机已经装好。');
      return;
    }
    if (this.inGallery) {
      this.setObjective('找到共振控制台。', '蕾恩的最终磁带就在阵列下方等着。');
      return;
    }
    this.setObjective('沿记忆走廊前往共振展厅。', '最终磁带正在阵列能听见的地方等着。');
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  enter() {
    super.enter();
    this.setCheckpoint(this.spawn.x, this.spawn.z, this.spawn.yaw);
    this._refreshObjective();
    this.game.audio.setTension(.14);
    this.game.ui.showHint('已经没有什么可逃的了。一直走，直到走廊打开。', 5.2);
  }

  onRespawn() {
    this.game.player.stamina = 1;
    this.game.player.staminaLocked = false;
    this._refreshObjective();
    if (this.tapeStarted && !this.choiceMade) {
      this.game.ui.showHint('磁带还在转。找到控制台。', 3.4);
    }
  }

  onChoice(id) {
    this.choiceMade = id;
    this._refreshObjective();
    if (id === 'purge') {
      this.game.audio.play('tapeStop', { volume: .32, rate: .4 });
      this.game.audio.play('powerUp', { volume: .28, rate: .5 });
      this._arrayLight.intensity = .18;
      this._consoleLight.intensity = .1;
      for (const mat of this._ringMaterials) mat.emissiveIntensity *= .12;
      this._coreMaterial.emissiveIntensity = .08;
      if (this._consoleScreen) this._consoleScreen.visible = false;
      this._arrayPulse = 0;
    } else {
      this.game.audio.play('alarm', { volume: .16, rate: .55 });
      this._arrayLight.intensity = 5.4;
      this._arrayLight.color.set(0xc3dccd);
      this._consoleLight.intensity = 3.6;
      for (const mat of this._ringMaterials) {
        mat.emissive.set(0xd9eadf);
        mat.emissiveIntensity = 2.6;
      }
      this._coreMaterial.emissive.set(0xf1fff5);
      this._coreMaterial.emissiveIntensity = 4.2;
      this._consoleScreen.visible = false;
      this._arrayPulse = 1;
    }
  }

  onUpdate(dt, elapsed) {
    const pulse = this._arrayPulse > 0 ? this._arrayPulse : 1;
    for (const entry of this._arrayRings) {
      entry.mesh.rotation.y += entry.speed * dt;
      entry.mesh.rotation.z = entry.tilt + Math.sin(elapsed * .17 + entry.tilt) * .035;
      if (!this.choiceMade) {
        const mat = entry.mesh.material;
        mat.emissiveIntensity = .85 + Math.sin(elapsed * .8 + entry.tilt * 2) * .18;
      }
    }
    for (const node of this._arrayNodes) {
      const a = node.phase + elapsed * .09;
      node.mesh.position.x = Math.cos(a) * node.radius;
      node.mesh.position.z = Math.sin(a) * node.radius;
      node.mesh.position.y = node.baseY + Math.sin(elapsed * .55 + node.phase * 2.1) * .08;
    }
    if (this._arrayCore) {
      const s = (1 + Math.sin(elapsed * 1.7) * .05) * pulse;
      this._arrayCore.scale.setScalar(s);
    }
    if (!this.choiceMade && this._arrayLight) {
      this._arrayLight.intensity = 2.9 + Math.sin(elapsed * 1.3) * .35;
      if (this.tapeStarted) this._arrayLight.intensity += .85;
    }
    if (this._arrayGlow) {
      this._arrayGlow.material.opacity = .018 + Math.sin(elapsed * .45) * .004;
    }
    if (this._arrayGlow2) {
      this._arrayGlow2.material.opacity = .009 + Math.sin(elapsed * .37 + 2) * .002;
    }
    if (this._consoleScreen && !this.choiceMade) {
      this._consoleScreen.material.emissiveIntensity = .45 + Math.sin(elapsed * 2.2) * .06;
    }
  }

  dispose() {
    this._arrayGroup = null;
    this._arrayRings.length = 0;
    this._arrayNodes.length = 0;
    super.dispose();
  }
}
