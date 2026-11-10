import * as THREE from 'three';
import { BaseLevel } from './BaseLevel.js';
import {
  addDesk, addChair, addLocker, addShelf, addCabinet, addCrate, addBarrel,
  addPipeRun, addRubble, makeBreakerPanel, makeKeypad
} from './Props.js';
import { Listener } from './Listener.js';
import {
  placeNote, addFusePickup, addLiftRecess, addCeilingLamp, addWaterSheen
} from './ChapterKit.js';
import { dressChapter3 } from './Dressing.js';

/**
 * CHAPTER III — SKINNY WALLS
 * A blind thing patrols the crew deck. The security office needs Wren's badge
 * number (0317). The substation needs one fuse. The lift needs you alive.
 */
export class Chapter3 extends BaseLevel {
  constructor(game, meta) {
    super(game, meta);
    this.id = 'skinny-walls';
    this.ambientTrack = 'skinnyWalls';
    this.spawn = { x: 0, z: 11.4, yaw: 0, pitch: -.02 };
    this.showNoise = true;
    this.allowHiding = true;
    this.officeOpened = false;
    this.powerOn = false;
    this.chaseActive = false;
    this.completed = false;
    this._leaving = false;
    this._chaseScheduled = false;
    this.listener = null;
    this.securityDoor = null;
    this.escapeTrigger = null;
    this.substationItem = null;
    this.chaseLights = [];
  }

  async build() {
    this.setAtmosphere({
      color: 0x030504,
      fogColor: 0x050706,
      fogDensity: .061
    });

    /* ---------------- Lift lobby ---------------- */
    this.addFloor(-2.2, 2.2, 7, 13, 'metalFloor', 0, .23, { surface: 'metal' });
    this.addCeiling(-2.2, 2.2, 7, 13, 'ceiling', 2.7);
    this.addWallZ(7, 13, -2.2, 2.75, 'paintedMetalDark');
    this.addWallZ(7, 13, 2.2, 2.75, 'paintedMetalDark');
    this.addWallX(-2.2, 2.2, 13, 2.75, 'paintedMetalDark');
    this.addWallX(-2.2, 2.2, 7, 2.8, 'paintedMetalDark', {
      openings: [{ x0: -1.5, x1: 1.5, height: 2.35 }]
    });
    this.addSign({
      x: 0, y: 2.52, z: 6.86, width: 1.05, height: .28,
      key: 'crew-deck-sign', title: '船员层', lines: ['安保 · 变电站 · 电梯'], titleSize: 32
    });

    /* ---------------- Corridor ---------------- */
    this.addFloor(-1.5, 1.5, -15, 7, 'metalFloorDark', 0, .22, { surface: 'metal' });
    this.addCeiling(-1.5, 1.5, -15, 7, 'ceiling', 2.75);
    this.addWallZ(-15, 7, -1.5, 2.8, 'concreteDark');
    this.addWallZ(-15, 7, 1.5, 2.8, 'concreteDark', {
      openings: [{ z0: -5.7, z1: -4.3, height: 2.2 }]
    });
    this.addDoorFrame('z', 1.5, -5.0, 1.4, 2.14, 'paintedMetalDark');
    this.addSign({
      x: 1.34, y: 2.2, z: -5.0, ry: -Math.PI / 2, width: .85, height: .24,
      key: 'security-door-sign', title: '安保', lines: ['03号办公室'], titleSize: 34
    });

    const door = this.addDoor({
      x: 1.5, z: -5.0, width: 1.4, height: 2.14, axis: 'z',
      material: 'paintedMetal', locked: true,
      lockedText: '门框旁的键盘闪着光。四位数字。',
      name: '安保办公室门', openAngle: 1.55
    });
    this.securityDoor = door;

    addPipeRun(this, [[-1.35, 2.45, 6.8], [-1.35, 2.45, -14.8]], { radius: .06, material: 'pipeGreen' });
    addPipeRun(this, [[1.25, 2.35, 6.8], [1.25, 2.35, -14.8]], { radius: .04, material: 'steelDull' });
    for (let z = 5.2; z > -14; z -= 4.8) {
      this.addStaticBox('warningYellow', 2.75, .025, .07, 0, 2.68, z, { scale: .7 });
    }
    this.addStaticBox('blackMetal', .75, .035, 16.2, 0, .015, -4.0, { scale: 1.1 });
    this.addBaseboard('x', -1.5, 1.5, -14.5, 2.8);
    this.addBaseboard('x', -1.5, 1.5, 6.5, 2.8);

    /* ---------------- Security office ---------------- */
    this.addFloor(1.5, 7.5, -8.5, -2, 'concreteFloor', 0, .23, { surface: 'concrete' });
    this.addCeiling(1.5, 7.5, -8.5, -2, 'ceiling', 2.85);
    this.addWallX(1.5, 7.5, -8.5, 2.9, 'concrete');
    this.addWallX(1.5, 7.5, -2, 2.9, 'concrete');
    this.addWallZ(-8.5, -2, 7.5, 2.9, 'concreteDark');
    this.addWallZ(-8.5, -5.7, 1.5, 2.9, 'concreteDark');
    this.addWallZ(-4.3, -2, 1.5, 2.9, 'concreteDark');
    addDesk(this, 4.75, -6.55, { width: 2.25, depth: .9, rotation: 0 });
    addChair(this, 4.75, -5.45, { rotation: Math.PI });
    addShelf(this, 5.95, -8.13, { width: 1.7, height: 1.9, depth: .38 });
    addCabinet(this, 4.35, -2.4, { rotation: Math.PI });
    addLocker(this, 7.05, -3.25, { rotation: -Math.PI / 2, hideable: true, open: true });
    addCrate(this, 2.2, -7.8, { size: .55, rotation: .14 });
    addCrate(this, 6.9, -7.8, { size: .6, rotation: -.16 });
    this.addStaticBox('blackGloss', .7, .5, .05, 7.38, 1.65, -6.4, { ry: -Math.PI / 2, scale: .8 });
    this.addStaticBox('emissiveGreen', .12, .035, .01, 7.34, 1.64, -6.4, { ry: -Math.PI / 2, scale: .3 });

    // Ceramic fuse, left on the desk in its cradle.
    addFusePickup(this, 4.35, .86, -6.65, {
      label: '拿走变电站保险丝',
      onPickup: () => {
        this.game.giveItem('fuse', '陶瓷保险丝');
        this.game.ui.showHint('这一层仅剩的保险丝。有人逃跑前把它从变电站里拔了出来。', 4.2);
        this.setCheckpoint(0, -4.55, -Math.PI / 2);
        this._refreshObjective();
      }
    });
    placeNote(this, 'security-log', 5.55, .84, -6.3, {
      rx: -Math.PI / 2, ry: -.08, width: .3, height: .38,
      label: '阅读最后一篇安保日志'
    });
    this.addStaticBox('paper', .3, .008, .4, 3.9, .81, -6.45, { scale: .4 });
    this.addStaticBox('paper', .26, .006, .34, 3.7, .808, -6.9, { scale: .4 });
    this.addDynamicPointLight(6.7, 2.2, -6.2, { color: 0xa8c1ac, intensity: .6, distance: 4.5, decay: 1.9 });

    /* ---------------- Keypad and note ---------------- */
    const keypad = makeKeypad(this, 1.37, 1.32, -6.15, { rotation: -Math.PI / 2 });
    const keypadItem = this.addInteractable({
      position: new THREE.Vector3(1.22, 1.28, -6.15),
      size: new THREE.Vector3(.42, .55, .6),
      range: 2.15,
      label: () => (this.officeOpened ? '安保键盘——已解锁' : '使用安保键盘'),
      sub: () => (this.officeOpened ? '' : 'E — 四位人员密码'),
      onInteract: () => this._openKeypad()
    });
    this.keypadItem = keypadItem;
    this.keypadMesh = keypad;
    placeNote(this, 'keypad-note', 1.38, 1.55, -6.92, {
      ry: -Math.PI / 2, width: .2, height: .28,
      label: '阅读便利贴'
    });
    this.game.ui.setItem('keycard', false);

    /* ---------------- Breaker room ---------------- */
    this.addFloor(-4, 4, -22, -15, 'concreteFloorDark', 0, .24, { surface: 'concrete' });
    this.addCeiling(-4, 4, -22, -15, 'ceiling', 3.4);
    this.addWallX(-4, 4, -15, 3.4, 'concreteDark', {
      openings: [{ x0: -1.5, x1: 1.5, height: 2.4 }]
    });
    this.addWallX(-4, 4, -22, 3.4, 'concreteDark');
    this.addWallZ(-22, -15, -4, 3.4, 'concreteDark');
    this.addWallZ(-22, -15, 4, 3.4, 'concreteDark');
    this.addDoorFrame('x', 0, -15, 3.0, 2.3, 'paintedMetalDark');
    this.addSign({
      x: 0, y: 2.72, z: -14.86, width: .9, height: .25,
      key: 'substation-sign', title: '变电站', lines: ['船员层 / 高压'], titleSize: 30
    });

    // Main substation cabinet.
    this.addStaticBox('paintedMetalDark', 2.4, 2.5, .35, 0, 1.25, -21.78, { scale: 1.4 });
    this.addStaticBox('warningYellow', 2.1, .12, .04, 0, 2.42, -21.58, { scale: .5 });
    this.addStaticBox('warningYellow', 2.1, .12, .04, 0, .16, -21.58, { scale: .5 });
    this.addStaticBox('blackMetal', .9, .55, .06, 0, 1.55, -21.58, { scale: .8 });
    this.addStaticBox('steelDull', .06, 2.1, .08, -1.0, 1.15, -21.57, { scale: .6 });
    this.addStaticBox('steelDull', .06, 2.1, .08, 1.0, 1.15, -21.57, { scale: .6 });
    makeBreakerPanel(this, 0, 1.72, -21.55, { rotation: 0, states: [true, true, false] });
    addPipeRun(this, [[.85, 3.3, -21.7], [.85, 2.45, -21.7], [.55, 2.45, -21.55]], { radius: .05, material: 'steelDull' });
    addPipeRun(this, [[-1.1, 3.3, -21.7], [-1.1, 2.45, -21.7]], { radius: .04, material: 'pipeRed' });
    this.addStaticBox('rustPaint', .8, .42, .55, -2.7, .21, -20.6, { scale: .8 });
    addRubble(this, 2.4, -20.9, .7, 5);
    addBarrel(this, -3.2, -18.5, { height: 1.0, radius: .3 });
    addCrate(this, 2.7, -16.3, { size: .62, rotation: .2 });
    placeNote(this, 'wren-note-2', 1.48, 1.22, -21.82, {
      ry: 0, width: .25, height: .34,
      label: '阅读保险丝座下的便条'
    });
    this.addStaticBox('steelDull', .38, .05, .25, 1.3, .94, -21.7, { scale: .5 });

    this.substationItem = this.addInteractable({
      position: new THREE.Vector3(0, 1.35, -21.1),
      size: new THREE.Vector3(1.5, 1.6, .8),
      range: 2.6,
      label: () => (this.powerOn ? '变电站——已通电' : '装入陶瓷保险丝'),
      sub: () => (this.powerOn ? '' : (this.game.hasItem('fuse') ? 'E — 闭合电路' : '保险丝座是空的')),
      onInteract: () => this._useSubstation()
    });

    /* ---------------- Hiding lockers ---------------- */
    addLocker(this, -1.13, 1.65, { rotation: Math.PI / 2, hideable: true, open: true });
    addLocker(this, 1.13, -.55, { rotation: -Math.PI / 2, hideable: true, open: true });
    addLocker(this, -1.13, -9.2, { rotation: Math.PI / 2, hideable: true, open: true });
    addCabinet(this, -1.35, 4.6, { rotation: Math.PI / 2 });
    addCrate(this, 1.12, 3.4, { size: .5, rotation: .3 });
    addCrate(this, -1.05, -12.7, { size: .58, rotation: -.2 });

    /* ---------------- Lift ---------------- */
    addLiftRecess(this, {
      x: 0, z: 12.84, axis: 'x', facing: -1, width: 1.8, height: 2.32,
      label: '呼叫船员电梯',
      sub: () => (this.chaseActive ? 'E — 还不行。先跑到那里。' : '电梯没有回应。'),
      onCall: () => {
        if (this.chaseActive) {
          this.game.ui.showHint('跑到跟前，门就会开。继续跑。', 2.6);
        } else {
          this.game.audio.play('locked', { volume: .26 });
          this.game.ui.showHint('电梯把自己锁死了。走廊北端的变电站控制着它。', 4);
        }
      }
    });
    this.addSign({
      x: 0, y: 2.47, z: 12.72, ry: Math.PI, width: .9, height: .27,
      key: 'lift-surface-sign', title: '检修电梯', lines: ['水面 · 仅限授权'], titleSize: 32
    });

    /* ---------------- Lighting ---------------- */
    addCeilingLamp(this, 0, 4.6, { y: 2.64, length: 1.5, intensity: .78, range: 6.8, flicker: true });
    addCeilingLamp(this, 0, -2.2, { y: 2.64, length: 1.35, intensity: .62, range: 6.2 });
    addCeilingLamp(this, 0, -9.7, { y: 2.64, length: 1.4, intensity: .7, range: 6.4, flicker: true });
    addCeilingLamp(this, 4.5, -6.3, { y: 2.72, length: 1.2, color: 0xd8e2c9, intensity: .8, range: 6.5 });
    this.addBakeLight(0, 2.1, 9.6, { color: 0x9db6a4, intensity: .45, range: 5.2 });
    this.addDynamicPointLight(0, 2.4, 11.0, { color: 0x8da698, intensity: .7, distance: 4.8, decay: 1.8 });
    this.addBakeLight(0, 3.0, -18.5, { color: 0xffbf8b, intensity: .75, range: 6.2 });
    addCeilingLamp(this, -2.4, -17.4, { y: 3.22, length: 1.1, intensity: .55, range: 5.5, flicker: true });
    this.addBakeLight(1.1, 2.2, -21.0, { color: 0xff6c52, intensity: .45, range: 4.2 });

    // Emergency lights for the chase are dark until the substation closes.
    const redA = this.addDynamicPointLight(0, 2.5, -11.2, { color: 0xff5c45, intensity: 0, distance: 9, decay: 1.5 });
    const redB = this.addDynamicPointLight(0, 2.4, 1.2, { color: 0xff5c45, intensity: 0, distance: 8, decay: 1.5 });
    this.addFlicker(redA, null, { baseIntensity: 3.2, baseEmissive: 0 });
    this.addFlicker(redB, null, { baseIntensity: 2.8, baseEmissive: 0 });
    this.chaseLights.push(redA, redB);

    /* ---------------- Dressing ---------------- */
    this.addPuddle(-.4, 2.2, 1.6, 2.1, { opacity: .35 });
    this.addPuddle(.8, -7.7, 1.2, 1.8, { opacity: .32 });
    this.addPuddle(-1.2, -12.3, 1.4, 2.4, { opacity: .3 });
    addWaterSheen(this, .78, 1.46, -14.6, 6.7, { y: .006, opacity: .2 });
    this.addDecal('hand', 1.48, 1.44, -3.0, .72, .72, { rx: 0, ry: -Math.PI / 2 });
    this.addDecal('grime', -1.48, 1.55, -8.3, 2.4, 2.0, { rx: 0, ry: Math.PI / 2 });
    this.addDecal('water', 6.0, 2.4, -8.48, 2.2, 1.2);
    this.addDecal('foot', .2, .012, -3.6, .65, 1.05, { rx: -Math.PI / 2, ry: .16 });
    this.addDecal('foot', -.05, .012, -4.2, .65, 1.05, { rx: -Math.PI / 2, ry: .08 });

    this.addSoundEmitter(0, 1.2, 3.2, { sound: 'drip', min: 3, max: 7, volume: .13, maxDistance: 13 });
    this.addSoundEmitter(0, 2.4, -10.8, { sound: 'metalGroan', min: 9, max: 18, volume: .12, rateMin: .42, rateMax: .6, maxDistance: 20 });
    this.addSoundEmitter(3.6, 1.1, -6.4, { sound: 'phoneRing', min: 24, max: 48, volume: .035, rateMin: .55, rateMax: .7, maxDistance: 6 });

    dressChapter3(this);

    /* ---------------- Listener ---------------- */
    this.listener = new Listener(this, {
      waypoints: [[0, -12.2], [0, -1.6]],
      startIndex: 0,
      patrolSpeed: .64,
      chaseSpeed: 3.05,
      alertDistance: 6.2,
      scale: 1.07
    });

    /* ---------------- Story triggers ---------------- */
    this.objective = { text: '找到安保办公室。', sub: '船员层不是空的。安静移动。' };

    this.addTrigger({
      x0: -2, x1: 2, z0: 6.6, z1: 7.2, once: true,
      onEnter: () => {
        if (this.listener.state !== 'dormant') {
          this.game.ui.showHint('有东西在走廊里走动。它没有眼睛。蹲下，或者躲起来。', 5.0);
          this.game.audio.whisper(3.2, .1);
          this.setCheckpoint(0, 5.6, 0);
        }
        this.game.audio.setTension(.2);
      }
    });
    this.addTrigger({
      x0: -5, x1: 8, z0: -8.6, z1: -1.9, once: true,
      onEnter: () => {
        this.game.ui.showHint('安保办公室。船员日志还在桌上。', 3.4);
        this.game.audio.setTension(.14);
      }
    });
    this.addTrigger({
      x0: -4, x1: 4, z0: -22, z1: -15, once: false,
      onEnter: () => {
        if (this.powerOn) return;
        this.game.ui.showHint('变电站。一个保险丝座，像张开的嘴。', 3.2);
      }
    });

    this.escapeTrigger = this.addTrigger({
      x0: -2.2, x1: 2.2, z0: 7.0, z1: 13.0, once: true,
      enabled: false,
      onEnter: () => this._escape()
    });
  }

  _openKeypad() {
    if (this.officeOpened) {
      this.game.ui.showHint('门已经开了。', 2);
      return;
    }
    this.game.openKeypad({
      code: '0317',
      title: '船员层安保',
      hint: '人员重置密码。四位数字。',
      brand: '哈尔西恩安保 / 03号办公室',
      onSuccess: () => {
        this.officeOpened = true;
        this.securityDoor.unlock();
        this.securityDoor.open();
        this.keypadMesh.screen.material = this.game.materials.get('emissiveGreen');
        this.keypadMesh.led.material = this.game.materials.get('emissiveGreen');
        this.keypadItem.setEnabled(false);
        this.game.audio.play('doorOpen', { volume: .3, rate: .9 });
        this.game.makeNoise(new THREE.Vector3(1.5, .2, -5), .5);
        this.game.ui.showHint('访问通过。办公室的门向内打开。', 3);
        this.setCheckpoint(0, -4.55, -Math.PI / 2);
        this._refreshObjective();
      },
      onFail: () => {
        this.game.makeNoise(new THREE.Vector3(1.4, .2, -6.1), .2);
      }
    });
  }

  _refreshObjective() {
    if (this._leaving || this.completed) return;
    if (this.powerOn) {
      this.setObjective('快跑。到达电梯。', '不要停。不要回头。');
      return;
    }
    if (this.game.hasItem('fuse')) {
      this.setObjective('把保险丝送到船员层变电站。', '在走廊北端。');
      return;
    }
    if (this.officeOpened) {
      this.setObjective('在安保办公室里找一枚保险丝。', '蕾恩的船员日志也许能解释这里发生了什么。');
      return;
    }
    this.setObjective('找到安保办公室。', '键盘需要四位人员密码。蕾恩的工牌号码是 0317。');
  }

  _useSubstation() {
    if (this.powerOn) return;
    if (!this.game.hasItem('fuse')) {
      this.game.audio.play('locked', { volume: .3 });
      this.game.ui.showHint('保险丝座是空的。只需要一枚陶瓷保险丝。', 3.4);
      return;
    }
    this.powerOn = true;
    this.game.takeItem('fuse');
    this.game.audio.play('powerUp', { volume: .38, rate: .8 });
    this.game.audio.play('alarm', { volume: .13, rate: .7 });
    this.game.audio.play('metalGroan', { volume: .19, rate: .5 });
    this.game.audio.setTension(1);
    this.game.ui.showHint('变电站闭合。这一层所有的灯都变成了红色。', 3.6);
    for (const light of this.chaseLights) light.intensity = 3.0;
    this.setCheckpoint(0, -13.0, Math.PI);
    this._refreshObjective();
    this.after(.9, () => this._beginChase());
  }

  _beginChase() {
    if (this.chaseActive || this.completed) return;
    this.chaseActive = true;
    this.allowHiding = false;
    this.game.player.staminaDrain = 11;
    this.game.player.stamina = 1;
    this.game.player.staminaLocked = false;
    // It comes out of the dark corner behind the substation, not from the only
    // exit. The player gets a fair head start but must commit to the sprint.
    this.listener.resetTo(new THREE.Vector3(-3.1, 0, -20.6));
    this.listener.setActive(true);
    this.listener.startChase();
    this.game.audio.setTension(1);
    this.game.ui.showHint('快跑。走廊里的东西不再伪装了。', 4.5);
    this.game.ui.say('信号', '艾瑞斯。别。', 3.0);
    this.game.player.addShake(.35);
    this.escapeTrigger.enabled = true;
    this.escapeTrigger.fired = false;
    this._refreshObjective();
  }

  _escape() {
    if (this.completed || !this.chaseActive) return;
    this.completed = true;
    this.allowHiding = true;
    this.listener.stopChase();
    this.listener.setActive(false);
    this.game.audio.setTension(.25);
    this.game.audio.play('keyGrant', { volume: .28 });
    this.game.audio.play('doorOpen', { volume: .34 });
    this.game.ui.showHint('电梯门开了。你跌进去。你没有回头。', 4);
    this.after(1.1, () => {
      if (this._leaving) return;
      this._leaving = true;
      this.game.completeChapter(3);
    });
  }

  onUpdate(dt) {
    this.listener?.update(dt);
  }

  enter() {
    super.enter();
    this.setCheckpoint(0, 11.4, 0);
    this._refreshObjective();
    this.game.audio.setTension(.18);
    this.game.ui.showHint('蹲伏可以安静移动。走廊开始回听时，躲进储物柜。', 5.5);
  }

  onRespawn() {
    if (this.completed) return;
    this.game.player.stamina = 1;
    this.game.player.staminaLocked = false;
    this.game.player.hidden = false;
    this.game.ui.setHiding(false);
    if (this.powerOn) {
      this.chaseActive = false;
      this.allowHiding = false;
      this.game.player.staminaDrain = 11;
      this.escapeTrigger.enabled = false;
      this.listener.resetTo(new THREE.Vector3(.7, 0, -20.3));
      this.listener.setActive(true);
      this._refreshObjective();
      this.after(1.5, () => {
        if (!this.completed && this.powerOn) this._beginChase();
      });
      this.game.ui.showHint('它还在追。再跑一次。不要停在声音前。', 4.2);
    } else {
      this.chaseActive = false;
      this.allowHiding = true;
      this.listener.resetTo(new THREE.Vector3(0, 0, -14.2));
      this.listener.setActive(true);
      this._refreshObjective();
    }
  }

  dispose() {
    this.listener?.dispose();
    this.listener = null;
    super.dispose();
  }
}
