import * as THREE from 'three';
import { BaseLevel } from './BaseLevel.js';
import {
  addDesk, addChair, addWorkbench, addShelf, addCrate, addBarrel,
  addCabinet, addRubble, addPipeRun, addOverheadDuct, makePumpLOD,
  makeBreakerPanel, makeRadio, makeCassetteMesh, makeKeycardMesh
} from './Props.js';
import { Listener } from './Listener.js';
import {
  placeNote, addFusePickup, addLiftRecess, addCeilingLamp, addWaterSheen
} from './ChapterKit.js';
import { getRecord } from '../story/content.js';
import { dressChapter2 } from './Dressing.js';

/**
 * CHAPTER II — THE LISTENING FLOOR
 * Three fuses, one dead breaker, and the first shape that is not supposed to
 * be standing in the light.
 */
export class Chapter2 extends BaseLevel {
  constructor(game, meta) {
    super(game, meta);
    this.id = 'listening-floor';
    this.ambientTrack = 'listeningFloor';
    this.spawn = { x: 7.25, z: 6.1, yaw: Math.PI / 2, pitch: -.03 };
    this.showNoise = false;
    this.fuses = new Set();
    this.powerOn = false;
    this.silhouetteShown = false;
    this._leaving = false;
    this.breaker = null;
    this.listener = null;
    this.powerTubes = [];
    this.powerGlow = [];
  }

  async build() {
    this.setAtmosphere({
      color: 0x030504,
      fogColor: 0x050807,
      fogDensity: .041
    });

    /* ---------------- Pump hall ---------------- */
    this.addFloor(-9, 9, -9, 9, 'metalFloorDark', 0, .26, { surface: 'metal' });
    this.addCeiling(-9, 9, -9, 9, 'ceiling', 4.35);
    this.addWallZ(-9, 9, -9, 4.45, 'concreteDark', {
      openings: [{ z0: -3.65, z1: -2.35, height: 2.25 }]
    });
    this.addWallZ(-9, 9, 9, 4.45, 'concreteDark');
    this.addWallX(-9, 9, 9, 4.45, 'concreteDark');
    this.addWallX(-9, 9, -9, 4.45, 'concreteDark', {
      openings: [{ x0: -3.65, x1: -2.35, height: 2.25 }]
    });
    this.addDoorFrame('x', -3.0, -9, 1.3, 2.2, 'paintedMetalDark');
    this.addSign({
      x: -3.0, y: 2.55, z: -8.86, width: 1.0, height: .26,
      key: 'observation-sign', title: '观察室', lines: ['阵列控制办公室'], titleSize: 34
    });

    // Bay markings and a central drainage channel.
    for (let x = -7.5; x <= 7.5; x += 3) {
      this.addStaticBox('warningYellow', .08, .012, 16.4, x, .012, 0, { scale: .6 });
    }
    this.addStaticBox('blackMetal', 1.1, .03, 16.2, 0, .005, 0, { scale: 1.2 });
    this.addStaticBox('steelDull', 1.25, .035, .12, 0, .018, 8.2, { scale: .6 });
    this.addStaticBox('steelDull', 1.25, .035, .12, 0, .018, -8.2, { scale: .6 });

    // Three main pumps. LOD keeps the distant ends cheap without losing scale.
    makePumpLOD(this, -5.4, -1.3);
    makePumpLOD(this, 0, -2.2);
    makePumpLOD(this, 5.4, -1.3);
    this.addStaticBox('steelDull', 1.1, .9, 1.0, -7.7, 2.35, -3.6, { scale: 1.2 });
    this.addStaticBox('steelDull', 1.1, .9, 1.0, 7.7, 2.35, -3.6, { scale: 1.2 });
    addPipeRun(this, [[-8.6, 3.5, -7.5], [-8.6, 3.5, 7.5]], { radius: .17, material: 'pipeRust' });
    addPipeRun(this, [[8.5, 3.1, -7.5], [8.5, 3.1, 7.5]], { radius: .11, material: 'pipeGreen' });
    addOverheadDuct(this, -7.8, 7.8, 2.8, 4.02, { radius: .34, material: 'steelDull' });
    addOverheadDuct(this, -7.8, 7.8, -4.5, 3.94, { radius: .23, material: 'rust' });
    for (let z = -7.4; z < 7.5; z += 3.7) {
      this.addStaticBox('steelDull', 16.6, .07, .1, 0, 3.95, z, { scale: 1.2 });
    }

    /* ---------------- Observation office ---------------- */
    this.addFloor(-5, 0, -15, -9, 'concreteFloorDark', 0, .23, { surface: 'concrete' });
    this.addCeiling(-5, 0, -15, -9, 'ceiling', 2.9);
    this.addWallZ(-15, -9, -5, 2.95, 'paintedMetalDark');
    this.addWallZ(-15, -9, 0, 2.95, 'paintedMetalDark');
    this.addWallX(-5, 0, -15, 2.95, 'concreteDark');
    this.addWallX(-5, 0, -9, 2.95, 'concreteDark', {
      openings: [{ x0: -3.65, x1: -2.35, height: 2.25 }]
    });
    // Internal window looking back across the pump hall.
    this.addStaticBox('glass', .06, 1.1, 2.6, -.03, 1.7, -11.1, { scale: 1 });
    this.addStaticBox('steelDull', .1, .08, 2.8, -.02, 1.12, -11.1, { scale: .8 });
    this.addStaticBox('steelDull', .1, .08, 2.8, -.02, 2.28, -11.1, { scale: .8 });
    this.addDoor({
      x: -3.0, z: -9, width: 1.3, height: 2.15, axis: 'x',
      material: 'paintedMetal', name: '观察室', locked: false, open: true
    });

    addDesk(this, -2.9, -13.1, { width: 2.25, depth: .9, rotation: 0 });
    addChair(this, -2.85, -12.05, { rotation: Math.PI });
    addShelf(this, -4.35, -14.55, { width: 1.2, height: 1.85, depth: .35 });
    addCabinet(this, -.9, -14.4, { rotation: 0 });
    addCrate(this, -4.4, -9.9, { size: .55, rotation: .1 });
    this.addStaticBox('blackGloss', 1.15, .55, .06, -.02, 1.88, -10.4, { scale: .8, ry: Math.PI / 2 });
    makeRadio(this, -4.3, 1.05, -14.45, { rotation: .2 });
    makeCassetteMesh(this, -2.1, .83, -13.2, { rotation: .2 });
    const tapeRecord = getRecord('tape-wren-1');
    this.addInteractable({
      position: new THREE.Vector3(-2.1, .92, -13.2),
      size: new THREE.Vector3(.4, .18, .32),
      range: 2.3,
      label: () => (this.game.hasRecord('tape-wren-1') ? '重播蕾恩的磁带' : '播放蕾恩的磁带'),
      sub: 'E — 磁带 04 / 1996年3月17日 03:11',
      onInteract: () => {
        this.game.audio.play('tapeStop', { volume: .22, rate: .88 });
        const isNew = this.game.collectRecord(tapeRecord);
        this.game.openNote(tapeRecord);
        if (isNew) this.game.ui.showToast('回收录音已归档——磁带 04');
      }
    });
    // Director-only addendum, left open on the desk.
    placeNote(this, 'array-memo', -3.95, .845, -13.35, {
      rx: -Math.PI / 2, ry: .08, width: .26, height: .34,
      label: '阅读晶格计划附录'
    });

    // Personnel badge. This is the gate for the chapter lift.
    makeKeycardMesh(this, -3.35, .82, -13.15);
    const badgeRecord = getRecord('badge-wren');
    const badgeItem = this.addInteractable({
      position: new THREE.Vector3(-3.35, .9, -13.15),
      size: new THREE.Vector3(.52, .34, .5),
      range: 2.3,
      label: () => (this.game.hasRecord('badge-wren') ? '查看蕾恩的工牌' : '拿起蕾恩的工牌'),
      sub: 'E — C级权限',
      onInteract: () => {
        const isNew = this.game.collectRecord(badgeRecord);
        this.game.openNote(badgeRecord);
        if (isNew) {
          this.game.ui.showHint('工牌 0317。号码印在卡片上。', 4.2);
          this.setCheckpoint(-2.6, -11.2, Math.PI);
          this._refreshObjective();
        }
      }
    });
    this.badgeItem = badgeItem;

    /* ---------------- Fuses ---------------- */
    addWorkbench(this, -7.75, 4.8, { width: 2.35, depth: .82 });
    addFusePickup(this, -7.2, 1.02, 4.75, {
      label: '拿走保险丝 A',
      onPickup: () => this._collectFuse('A')
    });
    placeNote(this, 'pump-log', -8.25, 1.0, 4.88, {
      rx: -Math.PI / 2, ry: .06, width: .3, height: .38,
      label: '阅读泵层工单'
    });

    addCrate(this, 6.55, -6.85, { size: .76, rotation: .12 });
    addCrate(this, 7.15, -6.4, { size: .52, rotation: -.2, y: 0 });
    addFusePickup(this, 6.55, .86, -6.85, {
      label: '拿走保险丝 B',
      onPickup: () => this._collectFuse('B')
    });
    addCrate(this, 6.95, 4.4, { size: .6, rotation: .3 });
    addBarrel(this, -6.9, -7.4, { height: 1.05, radius: .3 });
    addBarrel(this, 3.0, 6.6, { height: .92, radius: .28 });
    addRubble(this, -3.3, 6.4, .8, 5);

    // Fuse C sits in the shadow of the centre pump, behind a service hatch.
    addFusePickup(this, 1.25, .46, -1.0, {
      label: '拿走保险丝 C',
      onPickup: () => this._collectFuse('C')
    });
    this.addStaticBox('rustPaint', .5, .28, .35, 1.6, .16, -1.3, { scale: .7, ry: .25 });

    /* ---------------- Breaker ---------------- */
    const breaker = makeBreakerPanel(this, -8.82, 1.65, -5.35, {
      rotation: Math.PI / 2,
      states: [false, false, false]
    });
    this.breaker = breaker;
    this.addStaticBox('warningYellow', 1.4, .12, .04, -8.86, 2.28, -5.35, { scale: .5, ry: Math.PI / 2 });
    this.addSign({
      x: -8.86, y: 2.55, z: -5.35, ry: Math.PI / 2, width: 1.2, height: .28,
      key: 'breaker-sign', title: '辅助电源', lines: ['三联保险丝组 · 禁止半组启动'], titleSize: 28
    });
    const breakerItem = this.addInteractable({
      position: new THREE.Vector3(-8.48, 1.55, -5.35),
      size: new THREE.Vector3(.55, .95, .85),
      range: 2.35,
      label: () => (this.powerOn ? '断路器——已通电' : '把保险丝装入主断路器'),
      sub: () => (this.powerOn ? '' : `${this.fuses.size} / 3 枚陶瓷保险丝`),
      onInteract: () => this._useBreaker()
    });
    this.breakerItem = breakerItem;
    addPipeRun(this, [[-8.75, 3.8, -5.35], [-8.75, 2.2, -5.35], [-8.75, 1.7, -5.2]], { radius: .05, material: 'steelDull' });

    /* ---------------- Lift ---------------- */
    addLiftRecess(this, {
      x: 8.88, z: 6.25, axis: 'z', facing: -1, width: 1.85, height: 2.35,
      label: () => (this.game.hasRecord('badge-wren') ? '呼叫货运电梯' : '货运电梯——船员层超控'),
      sub: () => {
        if (!this.powerOn) return '没有电。呼叫面板是暗的。';
        if (!this.game.hasRecord('badge-wren')) return 'E — 需要蕾恩的工牌号码';
        return 'E — 上到船员层';
      },
      onCall: () => this._takeLift()
    });
    this.addSign({
      x: 8.8, y: 2.62, z: 6.25, ry: -Math.PI / 2, width: 1.1, height: .27,
      key: 'freight-lift', title: '船员层', lines: ['货运电梯 01 · 超控'], titleSize: 30
    });

    /* ---------------- Lighting ---------------- */
    // Two survival lamps are wired to the emergency bus before the breaker is restored.
    addCeilingLamp(this, -6.2, 6.3, { y: 4.1, length: 1.4, color: 0xff9f72, intensity: .52, range: 6.4, flicker: true });
    addCeilingLamp(this, 6.1, -7.2, { y: 4.1, length: 1.2, color: 0xff9f72, intensity: .45, range: 5.6, flicker: true });
    this.addBakeLight(-1.0, 2.2, -11.5, { color: 0xffc49a, intensity: .65, range: 5.5 });
    this.addDynamicPointLight(2.0, 3.1, -11.4, { color: 0x9fb9a8, intensity: .75, distance: 5.5, decay: 1.8 });

    // Main fixtures exist but are cold until the breaker closes.
    for (const [x, z] of [[-5.2, 1.5], [0, 1.5], [5.2, 1.5], [-5.2, -6.2], [5.2, -6.2], [0, -6.2]]) {
      const tube = addCeilingLamp(this, x, z, { y: 4.18, length: 2.05, lit: false });
      this.powerTubes.push(tube);
    }
    for (const [x, z] of [[-5.2, 1.5], [0, 1.5], [5.2, 1.5], [-5.2, -6.2], [5.2, -6.2], [0, -6.2]]) {
      const light = this.addDynamicPointLight(x, 3.95, z, { color: 0xffd0a0, intensity: 0, distance: 13, decay: 1.5 });
      this.powerGlow.push(light);
    }
    this.mainBakeLights = [
      this.addBakeLight(-5.2, 3.9, 1.5, { color: 0xffcf9d, intensity: 1.35, range: 13 }),
      this.addBakeLight(0, 3.9, 1.5, { color: 0xffcf9d, intensity: 1.3, range: 13 }),
      this.addBakeLight(5.2, 3.9, 1.5, { color: 0xffcf9d, intensity: 1.35, range: 13 }),
      this.addBakeLight(0, 3.9, -6.4, { color: 0xffcf9d, intensity: 1.2, range: 12 })
    ];
    // They are registered in the light array now, but the first bake must remain dark.
    for (const light of this.mainBakeLights) light.disabledUntilPower = true;
    this._applyPowerBakeMask();

    addCagedLampStub(this, -3.0, -8.8, 2.55);

    dressChapter2(this);

    /* ---------------- Dressing ---------------- */
    this.addPuddle(-2.6, 3.2, 3.0, 2.3, { opacity: .5 });
    this.addPuddle(2.0, -4.4, 2.8, 3.4, { opacity: .44 });
    this.addPuddle(6.3, 2.9, 2.2, 1.8, { opacity: .36 });
    addWaterSheen(this, -1.0, 1.0, -8.8, 8.8, { y: .01, opacity: .35, color: 0x27332e });
    this.addDecal('water', -8.98, 1.8, 2.2, 3.0, 2.0, { rx: 0, ry: Math.PI / 2 });
    this.addDecal('grime', .02, 2.0, -8.98, 3.0, 2.1);
    this.addDecal('mold', -4.98, 1.2, -12.1, 2.1, 1.5, { rx: 0, ry: Math.PI / 2 });
    this.addDecal('foot', -1.5, .012, -5.9, .7, 1.1, { rx: -Math.PI / 2, ry: -.2 });
    this.addDecal('hand', -.02, 1.45, -10.0, .7, .7, { rx: 0, ry: Math.PI / 2 });

    this.addSoundEmitter(-6.1, .3, 3.2, { sound: 'drip', min: 3, max: 7, volume: .16, maxDistance: 17 });
    this.addSoundEmitter(3.2, 3.4, -4.6, { sound: 'metalGroan', min: 11, max: 24, volume: .11, rateMin: .4, rateMax: .62, maxDistance: 22 });
    this.addSoundEmitter(7.9, .4, 8.3, { sound: 'drip', min: 6, max: 12, volume: .12, maxDistance: 13 });

    // The silhouette is a real Listener rig, left dormant for the reveal.
    this.listener = new Listener(this, {
      waypoints: [[0, -8.2], [0, 8.2]],
      patrolSpeed: .55,
      chaseSpeed: 2.9,
      scale: 1.1
    });
    this.listener.setActive(false);

    /* ---------------- Story ---------------- */
    this.objective = { text: '恢复辅助电源。', sub: '有人从主断路器上拔走了三枚陶瓷保险丝。' };
    this.addTrigger({
      x0: -9, x1: 9, z0: -3, z1: 9, once: true,
      onEnter: () => {
        this.game.ui.showHint('泵组静止。整层楼都在屏住呼吸。', 4.2);
        this.game.audio.setTension(.12);
        this.setCheckpoint(6.5, 5.4, Math.PI / 2);
      }
    });
    this.addTrigger({
      x0: -5, x1: 0, z0: -15, z1: -9, once: true,
      onEnter: () => {
        this.setCheckpoint(-2.6, -11.2, Math.PI);
        this._refreshObjective();
        this.game.audio.playAt('phoneRing', new THREE.Vector3(-4.3, 1.1, -14.4), { volume: .12, rate: .8 });
        this.game.ui.showHint('观察室还有应急电源。有人让台灯亮着。', 4.4);
      }
    });
  }

  _applyPowerBakeMask() {
    // Bake only the emergency lights for the first pass.
    this._allBakeLights = this.bakeLights.slice();
    this.bakeLights = this.bakeLights.filter((light) => !light.disabledUntilPower);
  }

  _collectFuse(id) {
    if (this.fuses.has(id)) return;
    this.fuses.add(id);
    this.game.setFuseState(true, `陶瓷保险丝 ${this.fuses.size}/3`);
    this.game.ui.showHint(`已回收保险丝 ${id}。${this.fuses.size}/3。`, 2.8);
    if (this.fuses.size > 1) this.setCheckpoint(1.5, 2.0, Math.PI);
    this._refreshObjective();
  }

  _refreshObjective() {
    if (this._leaving) return;
    if (this.powerOn) {
      if (!this.game.hasRecord('badge-wren')) {
        this.setObjective('去观察室找蕾恩的工牌。', '船员层电梯需要工牌号码。');
      } else {
        this.setObjective('呼叫货运电梯前往船员层。', '超控面板在等蕾恩的工牌号码。');
      }
      return;
    }
    if (this.fuses.size >= 3) {
      this.setObjective('把三枚保险丝全部装入主断路器。', '断路器组在西墙。');
    } else {
      this.setObjective('恢复辅助电源。', `已回收陶瓷保险丝：${this.fuses.size} / 3。`);
    }
  }

  _useBreaker() {
    if (this.powerOn) return;
    if (this.fuses.size < 3) {
      this.game.audio.play('locked', { volume: .3 });
      this.game.ui.showHint(`断路器组不接受残缺负载。已装入 ${this.fuses.size}/3 枚保险丝。`, 3.6);
      return;
    }
    this.powerOn = true;
    this.game.setFuseState(false);
    this.game.audio.play('powerUp', { volume: .34, rate: .82 });
    this.game.audio.play('metalGroan', { volume: .14, rate: .55 });
    this.game.audio.setTension(.38);
    this.game.ui.showHint('三相全部吸合。整层楼在你周围醒来。', 4);
    for (const sw of this.breaker.switches) {
      sw.on = true;
      sw.toggle.rotation.x = .55;
    }
    for (const tube of this.powerTubes) {
      tube.material.color.set(0xb6ad91);
      tube.material.emissive.set(0xffd2a0);
      tube.material.emissiveIntensity = 1.65;
    }
    for (const light of this.powerGlow) light.intensity = 2.6;
    this.bakeLights = this._allBakeLights || this.bakeLights;
    this.rebakeLighting();
    this.setCheckpoint(1.6, 2.8, Math.PI);
    this._refreshObjective();
    this.after(1.25, () => this._showSilhouette());
  }

  _showSilhouette() {
    if (this.silhouetteShown || !this.listener || this._leaving) return;
    this.silhouetteShown = true;
    const p = this.listener.root.position;
    p.set(1.1, 0, -8.55);
    this.listener.root.rotation.y = 0;
    this.listener.setVisible(true);
    this.game.audio.play('metalGroan', { volume: .16, rate: .38 });
    this.game.audio.whisper(3.6, .16);
    this.game.audio.setTension(.75);
    this.game.ui.showHint('大厅深处，有什么站在光够不到的地方。', 4.4);
    this.game.ui.say('信号', '艾瑞斯。', 2.8);
    this.after(3.0, () => {
      if (!this.listener) return;
      this.listener.setVisible(false);
      this.game.audio.setTension(.24);
    });
  }

  _takeLift() {
    if (this._leaving) return;
    if (!this.powerOn) {
      this.game.audio.play('locked', { volume: .3 });
      this.game.ui.showHint('呼叫面板死了。辅助电源仍然离线。', 3.3);
      return;
    }
    if (!this.game.hasRecord('badge-wren')) {
      this.game.audio.play('keyError', { volume: .2 });
      this.game.ui.showHint('船员层超控——请输入人员工牌号码。你还没有蕾恩的卡。', 4.2);
      return;
    }
    this._leaving = true;
    this.game.audio.play('keyGrant', { volume: .25 });
    this.game.audio.play('doorClose', { volume: .34, rate: .72 });
    this.game.ui.showHint('货运电梯开始上升。你身后的观察窗暗了下去。', 3.8);
    this.setCheckpoint(7.9, 6.4, Math.PI / 2);
    this.game.completeChapter(2);
  }

  enter() {
    super.enter();
    this._refreshObjective();
    this.game.audio.setTension(.08);
    this.game.ui.showHint('走，不要跑。声音在积水里传得很不一样。', 5.2);
  }

  dispose() {
    this.listener?.dispose();
    this.listener = null;
    super.dispose();
  }
}

function addCagedLampStub(level, x, z, y) {
  // A dead wall lamp in the doorway, kept deliberately weak.
  level.addStaticBox('steelDull', .24, .08, .2, x, y, z, { scale: .7 });
  level.addStaticBox('lampOff', .16, .04, .12, x, y - .05, z + .05, { scale: .5 });
}
