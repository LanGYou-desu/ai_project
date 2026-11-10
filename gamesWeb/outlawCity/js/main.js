"use strict";
const W = {
  viewW: 1280, viewH: 720,
  cssW: 1280, cssH: 720, dpr: 1, hudScaleX: 1, hudScaleY: 1,
  player: null, vehicles: [], npcs: [], pickups: [],
  gameTime: CFG.DAY_LENGTH * (11.5 / 24),
  state: "menu", stateTimer: 0,
  prompt: null, notifs: [], damageFlash: 0, aiming: false,
  lastGunshot: null,
  stats: { kills: 0, moneyEarned: 0, carsStolen: 0 },
  mapW: 0, mapH: 0, pauseGuard: 0,
  spawnCd: 0, pedCd: 0,
  hospital: { x: 160, y: 160 },
};
W.notify = function (text, color) {
  W.notifs.push({ text: text, t: 3.2, color: color || "#ffffff" });
  if (W.notifs.length > 5) W.notifs.shift();
};
W.addWanted = function (n) { PoliceSys.addWanted(n); };
W.onPlayerKilled = function (src) {
  const p = W.player;
  if (p.dead) return;
  p.dead = true;
  AudioSys.sirenStop();
  AudioSys.engineStop();
  if (p.vehicle) exitVehicle();
  AudioSys.death();
  W.prompt = null;
  W.aiming = false;
  Input.reset();
  W.state = "wasted";
  W.stateTimer = 3.5;
  Missions.onPlayerDied();
};
W.onPlayerBusted = function () {
  const p = W.player;
  if (p.dead) return;
  p.dead = true;
  AudioSys.sirenStop();
  AudioSys.engineStop();
  if (p.vehicle) exitVehicle();
  AudioSys.death();
  W.prompt = null;
  W.aiming = false;
  Input.reset();
  W.state = "busted";
  W.stateTimer = 3.5;
  const fine = Math.floor(p.money * 0.1);
  p.money -= fine;
  W.notify("你被逮捕了，罚款 $" + fine, "#f87171");
  Missions.onPlayerDied();
};
// HUD 始终以 1280×720 设计坐标绘制，通过 setTransform 放大到实际 DPR 缓冲，
// 这样 2K/4K 与高 DPI 屏幕上文字、准星、地图都不会被拉糊。
function fitViewport() {
  const wrap = document.getElementById("wrap");
  const glCanvas = document.getElementById("game3d");
  const hudCanvas = document.getElementById("hud");
  if (!glCanvas || !hudCanvas) return;
  let cssW = 0, cssH = 0;
  if (wrap && wrap.getBoundingClientRect) {
    const r = wrap.getBoundingClientRect();
    cssW = r.width || 0; cssH = r.height || 0;
  }
  if (!(cssW > 0) || !(cssH > 0)) { cssW = W.viewW; cssH = W.viewH; }
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  W.cssW = cssW; W.cssH = cssH; W.dpr = dpr;
  const bw = Math.max(1, Math.round(cssW * dpr));
  const bh = Math.max(1, Math.round(cssH * dpr));
  for (const cv of [glCanvas, hudCanvas]) {
    if (cv.width !== bw) cv.width = bw;
    if (cv.height !== bh) cv.height = bh;
    // 清掉可能由旧版 three 写入的 inline 像素尺寸，避免画布被锁在 1280×720
    if (cv.style) { cv.style.width = "100%"; cv.style.height = "100%"; }
  }
  W.hudScaleX = bw / W.viewW;
  W.hudScaleY = bh / W.viewH;
  if (typeof Render3D !== "undefined" && Render3D.renderer) Render3D.resize(cssW, cssH, dpr);
}

function startGame() {
  if (W.state !== "menu") return;
  W.state = "play";
  W.aiming = false;
  W.pauseGuard = 0;
  Input.reset();
  Input.centerMouse();
  if (W.player) {
    W.player.aim = W.player.heading || 0;
    if (Render3D.focusPlayer) Render3D.focusPlayer(true);
  }
  AudioSys.resume();
  AudioSys.missionStart();
  W.notify("自由探索！前往黄色 ? 标记接取任务", "#fde68a");
}

// 暂停/恢复只在主循环之外处理一次，避免 pointerlockchange 与 Esc keydown
// 同时触发时互相打架。
function pauseGame(fromLockLoss) {
  if (W.state !== "play") return;
  W.state = "paused";
  W.aiming = false;
  W.pauseGuard = fromLockLoss ? 0.16 : 0;
  Input.reset();
  Input.releaseLock();
}

function resumeGame() {
  if (W.state !== "paused") return;
  W.state = "play";
  W.pauseGuard = 0.12;
  // 点击暂停层的那次点击只负责恢复游戏/重新捕获鼠标，不触发射击。
  Input.mouse.down = false;
  Input.mouse.right = false;
  Input.mouse.pressed = false;
  Input.dx = 0;
  Input.dy = 0;
  Input.lastCX = null;
  Input.lastCY = null;
  Input.suppressShot = true;
  if (!Input.locked) Input.requestLock();
}

function boot() {
  const glCanvas = document.getElementById("game3d");
  const hudCanvas = document.getElementById("hud");
  if (!glCanvas || !hudCanvas) return;
  W.ctx = hudCanvas.getContext("2d");
  if (!W.ctx) return;
  W.viewW = 1280; W.viewH = 720;
  fitViewport();
  Input.init(hudCanvas);
  AudioSys.init();
  MapSys.init();
  W.mapW = MapSys.data.worldW; W.mapH = MapSys.data.worldH;
  Render3D.init(glCanvas, W.viewW, W.viewH);
  if (Render3D.disabled) W.notify("3D 渲染不可用：" + Render3D.errorMsg, "#f87171");
  fitViewport();
  Input.onLockChange = function (locked) {
    if (!locked && W.state === "play") {
      // 浏览器退出 Pointer Lock 与 Esc keydown 的先后顺序不稳定：
      // 用一个短保护窗吃掉同一次输入，避免刚暂停就自动恢复。
      pauseGame(true);
      W.notify("按 Esc 或点击画面继续", "#94a3b8");
    }
  };
  // 菜单/暂停层点击：开始、恢复或重新捕获鼠标。
  hudCanvas.addEventListener("mousedown", function (e) {
    if (!e || e.button !== 0 || e.target !== hudCanvas) return;
    if (W.state === "menu") {
      startGame();
    } else if (W.state === "paused" && W.pauseGuard <= 0) {
      resumeGame();
    }
  });
  window.addEventListener("resize", fitViewport);
  PoliceSys.init();
  Missions.init();
  initWorld();
  requestAnimationFrame(loop);
}
function initWorld() {
  W.player = new Player(W.hospital.x, W.hospital.y);
  // 第一屏就能看到人：出生广场与英雄商店前先放一组固定人群，其余散布全城。
  const crowd = [
    [190, 150], [205, 165], [220, 140], [235, 180], [250, 145],
    [270, 175], [290, 155], [305, 185], [185, 185], [215, 120],
    [300, 210], [335, 160], [340, 200], [180, 130],
    [238, 195], [262, 198],
    [130, 142], [150, 198], [176, 116], [112, 174]
  ];
  for (const pt of crowd) W.npcs.push(new NPC("civilian", pt[0], pt[1]));
  for (let i = 0; i < 18; i++) {
    const pt = MapSys.randomWalkablePoint();
    W.npcs.push(new NPC("civilian", pt.x, pt.y));
  }
  // 市中心固定人流：不提高平民刷新上限，只把初始人群分布到最容易看到的街口。
  const cell = MapSys.data.cell, road = MapSys.data.road;
  const downtownCrowd = [
    [cell * 2.88, cell * 2.78], [cell * 3.08, cell * 2.82],
    [cell * 2.80, cell * 3.10], [cell * 3.12, cell * 3.08],
    [cell * 2.60, cell * 2.90], [cell * 3.35, cell * 3.05],
    [cell * 2.92, cell * 3.35], [cell * 3.12, cell * 2.55],
    [cell * 3.70, cell * 3.20], [cell * 2.35, cell * 2.70],
    // 从路口向东的街段也安排行人，避免镜头一转就只有空街。
    [cell * 3.25, cell * 2.88], [cell * 3.50, cell * 2.90],
    [cell * 3.75, cell * 2.92], [cell * 3.25, cell * 3.12],
    [cell * 3.50, cell * 3.10], [cell * 3.80, cell * 3.12]
  ];
  for (const pt of downtownCrowd) {
    const w = MapSys.walkableNear(pt[0], pt[1], 42);
    W.npcs.push(new NPC("civilian", w.x, w.y));
  }
  // 先放几辆固定热点车，再补随机车流；街口不再完全靠随机数决定有没有车。
  const hotTraffic = [
    { axis: "v", x: cell, y: cell * 1.45, dir: 1 },
    { axis: "h", x: cell * 1.55, y: cell, dir: -1 },
    { axis: "v", x: cell * 3, y: cell * 2.35, dir: -1 },
    { axis: "h", x: cell * 2.45, y: cell * 3, dir: 1 },
    { axis: "v", x: cell * 3, y: cell * 3.4, dir: 1 },
    { axis: "h", x: cell * 3.55, y: cell * 3, dir: -1 },
    { axis: "v", x: cell * 4, y: cell * 2.6, dir: -1 },
    { axis: "h", x: cell * 2.2, y: cell * 2, dir: 1 }
  ];
  for (const rp of hotTraffic) spawnTraffic({ axis: rp.axis, x: rp.x, y: rp.y, dir: rp.dir, lane: rp.dir * road / 4 });
  for (let i = 0; i < 26; i++) spawnTraffic();
  spawnParkedVehicles();
  const pts = [MapSys.cellCenter(3, 3), MapSys.cellCenter(7, 5), MapSys.cellCenter(11, 9), MapSys.cellCenter(5, 5), MapSys.cellCenter(8, 8), MapSys.cellCenter(2, 6)];
  W.pickups.push(new Pickup("health", pts[0].x, pts[0].y));
  W.pickups.push(new Pickup("armor", pts[1].x, pts[1].y));
  W.pickups.push(new Pickup("ammo", pts[2].x, pts[2].y));
  W.pickups.push(new Pickup("money", pts[3].x, pts[3].y, 200));
  W.pickups.push(new Pickup("health", pts[4].x, pts[4].y));
  W.pickups.push(new Pickup("armor", pts[5].x, pts[5].y));
}
function spawnTraffic(spot) {
  const rp = spot || MapSys.randomRoadPoint();
  // 车辆种类不再只有轿车/跑车/出租/卡车：厢货、SUV、皮卡、肌肉车、巴士与礼车
  // 都会进入交通流，车身轮廓和驾驶手感各不相同。
  const types = [
    "sedan", "sedan", "taxi", "sports", "van", "suv", "pickup",
    "muscle", "truck", "bike", "bus", "limo"
  ];
  const type = Utils.choice(types);
  const heading = rp.axis === "v" ? (rp.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (rp.dir > 0 ? 0 : Math.PI);
  const v = new Vehicle(type, rp.x, rp.y, heading);
  v.ai = makeTrafficAI(v, { axis: rp.axis, x: rp.x, y: rp.y, dir: rp.dir, lane: rp.lane });
  W.vehicles.push(v);
}

function spawnParkedVehicles() {
  // 路边停车是城市密度最直接的来源；它们不是 AI 车，玩家仍然可以上车。
  const cell = MapSys.data.cell, road = MapSys.data.road;
  const slots = [
    [cell - road * 0.36, cell * 0.50, Math.PI / 2, "sedan"],
    [cell * 0.50, cell - road * 0.36, 0, "suv"],
    [cell - road * 0.36, cell * 1.30, -Math.PI / 2, "van"],
    [cell * 1.55, cell - road * 0.36, Math.PI, "pickup"],
    [cell * 2 - road * 0.36, cell * 1.75, Math.PI / 2, "muscle"],
    [cell * 1.55, cell * 2 - road * 0.36, 0, "taxi"],
    [cell * 3 - road * 0.36, cell * 2.55, Math.PI / 2, "sports"],
    [cell * 2.55, cell * 3 - road * 0.36, Math.PI, "limo"],
    [cell * 0.65, cell * 3 - road * 0.36, 0, "sedan"],
    [cell * 3.25, cell - road * 0.36, 0, "van"],
    [cell - road * 0.36, cell * 0.20, Math.PI / 2, "sports"],
    [cell - road * 0.36, cell * 0.80, -Math.PI / 2, "bike"],
    [cell * 0.20, cell - road * 0.36, 0, "pickup"],
    [cell * 0.80, cell - road * 0.36, Math.PI, "truck"],
    // 市中心路口四角也安排路边停车，避免最显眼的街口只有空旷车道。
    [cell * 2.75, cell * 3 - road * 0.36, 0, "sedan"],
    [cell * 2.75, cell * 3 + road * 0.36, Math.PI, "suv"],
    [cell * 2.55, cell * 3 - road * 0.36, Math.PI / 2, "van"],
    [cell * 3 - road * 0.36, cell * 2.75, Math.PI / 2, "sports"],
    [cell * 3 + road * 0.36, cell * 2.75, -Math.PI / 2, "taxi"],
    [cell * 3.25, cell * 3 - road * 0.36, Math.PI, "muscle"],
    [cell * 3.45, cell * 3 - road * 0.36, 0, "taxi"],
    [cell * 3.65, cell * 3 + road * 0.36, Math.PI, "sedan"],
    [cell * 3.95, cell * 3 - road * 0.36, 0, "suv"],
    [cell * 3.85, cell * 3 + road * 0.36, Math.PI, "van"]
  ];
  for (const s of slots) {
    const v = new Vehicle(s[3], s[0], s[1], s[2]);
    v.parked = true;
    W.vehicles.push(v);
  }
}
function mouseWorld() {
  return Render3D.aimPoint();
}
const LOOK_X = 0.0024;
const LOOK_Y = 0.0021;
const PLAYER_CTRL = { throttle: 0, steer: 0, brake: false, handbrake: false };

function resetVehicleControl() {
  PLAYER_CTRL.throttle = 0;
  PLAYER_CTRL.steer = 0;
  PLAYER_CTRL.brake = false;
  PLAYER_CTRL.handbrake = false;
}

function update(dt) {
  W.gameTime += dt;
  W.damageFlash = Math.max(0, W.damageFlash - dt * 2);
  const p = W.player;
  if (W.lastGunshot) { W.lastGunshot.t -= dt; if (W.lastGunshot.t <= 0) W.lastGunshot = null; }

  // 武器与镜头输入：每帧只消费一次。
  if (Input.consume("KeyQ")) p.cycleWeapon(-1);
  for (let i = 0; i < p.weapons.length; i++) {
    if (Input.consume("Digit" + (i + 1))) p.equip(i);
  }
  if (Input.wheel !== 0) p.cycleWeapon(Input.wheel > 0 ? 1 : -1);
  if (Input.consume("KeyR")) p.startReload();
  if (Input.keys.Equal || Input.keys.NumpadAdd) {
    Render3D.camZoom = Utils.clamp(Render3D.camZoom - 0.65 * dt, 0.72, 1.45);
  }
  if (Input.keys.Minus || Input.keys.NumpadSubtract) {
    Render3D.camZoom = Utils.clamp(Render3D.camZoom + 0.65 * dt, 0.72, 1.45);
  }

  const pdef = CFG.WEAPONS[p.weapon()];
  W.aiming = !!(Input.mouse.right && !p.vehicle && !p.dead && !(pdef && pdef.melee));
  const look = Input.takeLook();
  if (look.x !== 0 || look.y !== 0) {
    Render3D.rotateCam(look.x * LOOK_X, look.y * LOOK_Y);
  }

  // 半自动武器只认鼠标按下边沿；全自动武器按按住处理。
  const fireEdge = Input.consumeMouse();
  const fireHeld = Input.mouse.down;
  const wantFire = pdef && pdef.auto ? fireHeld : fireEdge;

  p.updateReload(dt);
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  p.muzzleT = Math.max(0, p.muzzleT - dt);
  p.meleeSwing = Math.max(0, p.meleeSwing - dt * 4);
  p.dmgFlash = Math.max(0, p.dmgFlash - dt * 3);

  // 准星始终取屏幕中心射线。镜头肩位把角色放到准星左侧，
  // 但子弹/近战方向仍从角色指向准星落点。
  const mw = Render3D.aimPoint();
  p.aim = Utils.angleTo(p.x, p.y, mw.x, mw.y);

  if (p.vehicle) {
    if (Input.consume("KeyE")) {
      exitVehicle();
    }
    if (p.vehicle) {
      if (wantFire) playerShoot(true);
      AudioSys.engineUpdate(Math.abs(p.vehicle.fs) / p.vehicle.def.maxSpeed);
    }
  } else {
    playerFootUpdate(dt);
    if (Input.consume("KeyE")) tryInteract();
    if (wantFire) playerShoot(false);
  }

  for (const v of W.vehicles) v.update(dt);
  if (p.vehicle) { p.x = p.vehicle.x; p.y = p.vehicle.y; }
  for (const n of W.npcs) n.update(dt);
  PoliceSys.update(dt);
  Missions.update(dt);
  Combat.update(dt);
  for (const pk of W.pickups) pk.update(dt);
  for (let i = W.pickups.length - 1; i >= 0; i--) if (W.pickups[i].dead) W.pickups.splice(i, 1);

  W.spawnCd -= dt;
  if (W.spawnCd <= 0) {
    W.spawnCd = 1.8;
    let cars = 0;
    for (const v of W.vehicles) if (v.ai && !v.ai.police && !v.ai.escort) cars++;
    if (cars < 38) spawnTraffic();
  }
  W.pedCd -= dt;
  if (W.pedCd <= 0) {
    W.pedCd = 0.85;
    let civs = 0;
    for (let i = W.npcs.length - 1; i >= 0; i--) {
      const n = W.npcs[i];
      if (n.dead && n.deathTimer > 30) { W.npcs.splice(i, 1); continue; }
      if (!n.dead && n.type === "civilian") civs++;
    }
    if (civs < 36) {
      const pt = MapSys.randomWalkablePoint();
      W.npcs.push(new NPC("civilian", pt.x, pt.y));
    }
  }
  updatePrompt();
}

function playerFootUpdate(dt) {
  const p = W.player;
  const k = Input.keys;
  let ix = 0, iz = 0;
  if (k.KeyW || k.ArrowUp) iz += 1;
  if (k.KeyS || k.ArrowDown) iz -= 1;
  if (k.KeyD || k.ArrowRight) ix += 1;
  if (k.KeyA || k.ArrowLeft) ix -= 1;

  const sprint = !!(k.ShiftLeft || k.ShiftRight) && !W.aiming;
  let tx = 0, ty = 0;
  if (ix !== 0 || iz !== 0) {
    // 镜头坐标系：W 沿屏幕上方，D 沿屏幕右方。
    const sv = Render3D.screenVecs();
    let wx = sv.rx * ix + sv.ux * iz;
    let wz = sv.rz * ix + sv.uz * iz;
    const wl = Utils.hypot(wx, wz) || 1;
    wx /= wl; wz /= wl;
    const speed = W.aiming
      ? CFG.PLAYER.speed * 0.55
      : (sprint ? CFG.PLAYER.sprint : CFG.PLAYER.speed);
    tx = wx * speed;
    ty = wz * speed;
    p.heading = Utils.angleLerp(p.heading, Math.atan2(wz, wx), 1 - Math.exp(-14 * dt));
  }

  // 保留轻微惯性，但松键后能很快停住。
  const accel = (ix !== 0 || iz !== 0) ? (sprint ? 16 : 13) : 11;
  const blend = 1 - Math.exp(-accel * dt);
  p.vx = Utils.lerp(p.vx, tx, blend);
  p.vy = Utils.lerp(p.vy, ty, blend);
  if (ix === 0 && iz === 0 && Utils.hypot(p.vx, p.vy) < 3) {
    p.vx = 0;
    p.vy = 0;
  }

  const sx = p.vx * dt, sy = p.vy * dt;
  const travel = Utils.hypot(sx, sy);
  let moved = 0;
  if (travel > 0.001) {
    // 高速或掉帧时细分碰撞步长，避免一帧直接穿过墙角。
    const steps = Math.max(1, Math.min(5, Math.ceil(travel / Math.max(4, CFG.PLAYER.radius * 0.65))));
    const stepX = sx / steps, stepY = sy / steps;
    for (let i = 0; i < steps; i++) {
      const ox = p.x, oy = p.y;
      const wantX = ox + stepX, wantY = oy + stepY;
      const res = MapSys.resolve(wantX, wantY, CFG.PLAYER.radius, RES_SCRATCH);
      // 撞墙只削掉被阻挡方向的速度，沿墙滑行仍然顺滑。
      if (Math.abs(res.x - wantX) > 0.5) p.vx *= 0.18;
      if (Math.abs(res.y - wantY) > 0.5) p.vy *= 0.18;
      moved += Utils.dist(ox, oy, res.x, res.y);
      p.x = res.x;
      p.y = res.y;
    }
    p.moveSpeed = moved / dt;
  } else {
    p.moveSpeed = 0;
  }
  p.walkPhase += p.moveSpeed * dt * 0.055;
}

function playerVehicleControl(dt) {
  const k = Input.keys;
  let throttle = 0, steer = 0;
  if (k.KeyW || k.ArrowUp) throttle += 1;
  if (k.KeyS || k.ArrowDown) throttle -= 1;
  if (k.KeyA || k.ArrowLeft) steer -= 1;
  if (k.KeyD || k.ArrowRight) steer += 1;
  const tk = 1 - Math.exp(-9 * dt);
  const sk = 1 - Math.exp(-13 * dt);
  PLAYER_CTRL.throttle = Utils.lerp(PLAYER_CTRL.throttle, throttle, tk);
  PLAYER_CTRL.steer = Utils.lerp(PLAYER_CTRL.steer, steer, sk);
  if (Math.abs(PLAYER_CTRL.throttle) < 0.01) PLAYER_CTRL.throttle = 0;
  if (Math.abs(PLAYER_CTRL.steer) < 0.01) PLAYER_CTRL.steer = 0;
  PLAYER_CTRL.brake = false;
  PLAYER_CTRL.handbrake = !!k.Space;
  return PLAYER_CTRL;
}

function playerShoot(fromCar) {
  const p = W.player;
  // 捕获鼠标的那一次按压整段失效：半自动只会有一次边沿，
  // 全自动也不能在按住时于后续帧补射。下一帧真正的 mousedown 会清掉它。
  if (Input.suppressShot) return;
  const w = p.weapon();
  const def = CFG.WEAPONS[w];
  if (!def || p.reloading || p.fireTimer > 0 || p.dead) return;
  if (def.melee) {
    p.fireTimer = 1 / def.rate;
    p.meleeSwing = 1;
    Combat.fireWeapon("player", w, p.x, p.y, p.aim);
    return;
  }
  if (p.mag[w] <= 0) {
    if (p.ammo[w] > 0) p.startReload();
    return;
  }
  p.fireTimer = 1 / def.rate;
  let ox = p.x, oy = p.y;
  if (fromCar && p.vehicle) {
    ox = p.vehicle.x + Math.cos(p.vehicle.heading) * p.vehicle.def.h * 0.45;
    oy = p.vehicle.y + Math.sin(p.vehicle.heading) * p.vehicle.def.h * 0.45;
  }
  Combat.fireWeapon("player", w, ox, oy, p.aim, W.aiming ? 0.55 : 1);
  p.mag[w]--;
  p.muzzleT = 0.08;
  if (p.mag[w] <= 0 && p.ammo[w] > 0) p.startReload();
}

function tryInteract() {
  const p = W.player;
  if (Missions.tryStart(p.x, p.y)) return;
  let best = null, bd = 1e9;
  for (const v of W.vehicles) {
    if (v.wrecked || v.driver === p) continue;
    const d = Utils.dist(p.x, p.y, v.x, v.y);
    if (d < v.radius + 26 && d < bd) { bd = d; best = v; }
  }
  if (best) enterVehicle(best);
}

function enterVehicle(v) {
  const p = W.player;
  if (p.vehicle || v.wrecked) return;
  p.vehicle = v;
  v.driver = p;
  p.x = v.x;
  p.y = v.y;
  p.heading = v.heading;
  p.aim = v.heading;
  p.vx = 0;
  p.vy = 0;
  p.moveSpeed = 0;
  resetVehicleControl();
  W.stats.carsStolen++;
  if (v.type === "police") {
    W.addWanted(1);
    W.notify("你偷了一辆警车！", "#f87171");
    PoliceSys.onCarStolen(v);
  }
  AudioSys.engineStart();
  AudioSys.horn();
  // 上车直接落到车尾后方，不做旧相机那种“从角色后方荡到车后”的过渡。
  if (typeof Render3D !== "undefined" && Render3D.focusPlayer) {
    Render3D.camPitch = 0.17;
    Render3D.mouseIdleT = 0;
    Render3D.focusPlayer(true);
  }
}

function exitVehicle() {
  const p = W.player, v = p.vehicle;
  if (!v) return;
  v.driver = null;
  p.vehicle = null;

  // 依次尝试车辆左侧、右侧、后方、前方，选第一个可站立位置。
  const dist = v.radius + CFG.PLAYER.radius + 12;
  let ex = v.x + Math.cos(v.heading + Math.PI / 2) * dist;
  let ey = v.y + Math.sin(v.heading + Math.PI / 2) * dist;
  let found = false;
  for (const off of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
    const cx = v.x + Math.cos(v.heading + off) * dist;
    const cy = v.y + Math.sin(v.heading + off) * dist;
    const res = MapSys.resolve(cx, cy, CFG.PLAYER.radius, RES_SCRATCH);
    if (!MapSys.isBlocked(res.x, res.y)) {
      ex = res.x;
      ey = res.y;
      found = true;
      break;
    }
  }
  if (!found) {
    const res = MapSys.resolve(ex, ey, CFG.PLAYER.radius, RES_SCRATCH);
    ex = res.x;
    ey = res.y;
  }
  p.x = ex;
  p.y = ey;
  p.vx = 0;
  p.vy = 0;
  p.moveSpeed = 0;
  p.heading = v.heading;
  p.aim = v.heading;
  resetVehicleControl();
  AudioSys.engineStop();
  // 下车时保留当前观察方向，只把弹簧臂从车辆追尾切换回步行肩位，
  // 不强制把镜头甩到车头方向。
  if (typeof Render3D !== "undefined" && Render3D.snapCamera) {
    Render3D.camAim = 0;
    Render3D.mouseIdleT = 99;
    Render3D.snapCamera();
  }
}

function updatePrompt() {
  const p = W.player;
  W.prompt = null;
  if (p.vehicle) { W.prompt = { x: p.x, y: p.y, text: "按 E 下车" }; return; }
  if (!Missions.current) {
    for (const mk of Missions.markers) {
      if (Utils.dist(p.x, p.y, mk.x, mk.y) < 70) { W.prompt = { x: p.x, y: p.y, text: "按 E 开始任务" }; return; }
    }
    if (Missions.taxiUnlocked && Utils.dist(p.x, p.y, Missions.taxiStand.x, Missions.taxiStand.y) < 70) {
      W.prompt = { x: p.x, y: p.y, text: "按 E 接出租车生意" }; return;
    }
  }
  let best = null, bd = 1e9;
  for (const v of W.vehicles) {
    if (v.wrecked || v.driver) continue;
    const d = Utils.dist(p.x, p.y, v.x, v.y);
    if (d < v.radius + 26 && d < bd) { bd = d; best = v; }
  }
  if (best) W.prompt = { x: p.x, y: p.y, text: "按 E 上车" };
}
function respawn() {
  const p = W.player;
  PoliceSys.addWanted(-5);
  for (const c of W.police.cars.slice()) PoliceSys.removeSquad(c);
  W.police.cars = [];
  AudioSys.sirenStop();
  W.npcs = W.npcs.filter(n => !n.police && !n.gang);
  p.x = W.hospital.x; p.y = W.hospital.y;
  p.heading = 0;
  p.vx = 0; p.vy = 0; p.moveSpeed = 0;
  p.health = CFG.PLAYER.health;
  p.armor = 0;
  p.dead = false;
  p.ammo = {};
  for (const k in CFG.START_AMMO) p.ammo[k] = Math.floor(CFG.START_AMMO[k] * 0.6);
  for (const k of p.weapons) p.mag[k] = 0;
  p.mag.pistol = CFG.WEAPONS.pistol.mag;
  p.reloading = false;
  W.prompt = null;
  W.aiming = false;
  W.pauseGuard = 0;
  Input.reset();
  p.aim = p.heading;
  if (typeof Render3D !== "undefined" && Render3D.focusPlayer) {
    Render3D.camZoom = 1;
    Render3D.focusPlayer(true);
  }
  W.state = "play";
}

let lastT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) dt = 0.016;
  if (W.pauseGuard > 0) W.pauseGuard -= dt;

  if (W.state === "play") {
    if (Input.consume("Escape")) pauseGame(false);
    else update(dt);
  } else if (W.state === "paused") {
    if (W.pauseGuard > 0) {
      // 吃掉触发暂停的同一次 Esc / 点击，不让它立刻恢复。
      Input.pressed.Escape = false;
      Input.mouse.down = false;
      Input.mouse.pressed = false;
    } else if (Input.consume("Escape") || Input.consumeMouse()) {
      resumeGame();
    }
  } else if (W.state === "menu") {
    AudioSys.resume();
    if (Input.consume("Enter") || Input.consume("NumpadEnter")) startGame();
  } else {
    W.stateTimer -= dt;
    if (W.stateTimer <= 0) respawn();
  }

  for (const n of W.notifs) n.t -= dt;
  for (let i = W.notifs.length - 1; i >= 0; i--) if (W.notifs[i].t <= 0) W.notifs.splice(i, 1);
  Input.clearPressed();
  render(dt);
}
function render(dt) {
  Render3D.update(dt);
  const ctx = W.ctx;
  // 设计坐标 → 物理像素缓冲；HUD/菜单都按 1280×720 绘制
  ctx.setTransform(W.hudScaleX || 1, 0, 0, W.hudScaleY || 1, 0, 0);
  ctx.clearRect(0, 0, W.viewW, W.viewH);
  if (W.state !== "menu") HUD.draw(ctx);
  if (Render3D.disabled) drawError(ctx);
  if (W.state === "menu") drawMenu(ctx);
  if (W.state === "paused") drawPause(ctx);
  if (W.state === "wasted") drawBigText(ctx, "WASTED", "#ef4444");
  if (W.state === "busted") drawBigText(ctx, "BUSTED", "#38bdf8");
  const p = W.player;
  if (p && p.health < 25 && W.state === "play") {
    const a = (25 - p.health) / 25 * 0.35;
    ctx.fillStyle = "rgba(200,20,20," + a + ")";
    ctx.fillRect(0, 0, W.viewW, W.viewH);
  }
}
function drawError(ctx) {
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, W.viewH / 2 - 60, W.viewW, 120);
  ctx.fillStyle = "#f87171";
  ctx.font = "bold 26px 'Segoe UI', sans-serif";
  ctx.fillText("3D 渲染不可用", W.viewW / 2, W.viewH / 2 - 12);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "16px 'Segoe UI', sans-serif";
  ctx.fillText(Render3D.errorMsg || "浏览器/显卡未提供 WebGL", W.viewW / 2, W.viewH / 2 + 24);
  ctx.textAlign = "left";
}
function drawMenu(ctx) {
  const w = W.viewW, h = W.viewH;
  // 左侧可读性遮罩，右侧保留城市画面；边缘用一条暖色斜线做“街头海报”的分界。
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "rgba(3, 7, 13, 0.97)");
  g.addColorStop(0.40, "rgba(3, 7, 13, 0.90)");
  g.addColorStop(0.62, "rgba(3, 7, 13, 0.48)");
  g.addColorStop(1, "rgba(3, 7, 13, 0.08)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const vg = ctx.createLinearGradient(0, 0, 0, h);
  vg.addColorStop(0, "rgba(2, 4, 8, 0.62)");
  vg.addColorStop(0.24, "rgba(2, 4, 8, 0)");
  vg.addColorStop(0.80, "rgba(2, 4, 8, 0)");
  vg.addColorStop(1, "rgba(2, 4, 8, 0.84)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = HUD.c.red;
  ctx.fillRect(64, 34, 3, 30);
  ctx.fillStyle = HUD.c.amber;
  ctx.fillRect(76, 35, 28, 2);
  ctx.font = "700 10px " + HUD.font;
  ctx.fillStyle = HUD.c.muted;
  ctx.fillText("NIGHTFALL DISTRICT  //  SECTOR 07  //  AFTER HOURS", 76, 56);
  ctx.textAlign = "right";
  ctx.fillStyle = HUD.c.cyan;
  ctx.font = "700 11px " + HUD.mono;
  ctx.fillText("17:30  /  DUSK", w - 64, 56);
  ctx.textAlign = "left";

  // 巨大的街区编号只做背景水印，不抢标题
  ctx.save();
  ctx.textAlign = "right";
  ctx.globalAlpha = 0.038;
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 238px " + HUD.font;
  ctx.fillText("07", w - 44, h - 30);
  ctx.restore();

  // 倾斜色块和标题组合，和 HUD 的斜切面板保持同一套语言。
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = HUD.c.amber;
  ctx.beginPath();
  ctx.moveTo(46, 110);
  ctx.lineTo(64, 110);
  ctx.lineTo(40, 206);
  ctx.lineTo(22, 206);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const titleGrad = ctx.createLinearGradient(0, 108, 0, 202);
  titleGrad.addColorStop(0, "#fff4d6");
  titleGrad.addColorStop(0.56, "#ffc25c");
  titleGrad.addColorStop(1, "#f07b2a");
  ctx.save();
  ctx.shadowColor = "rgba(255, 140, 40, 0.30)";
  ctx.shadowBlur = 26;
  ctx.font = "800 88px " + HUD.font;
  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fillText("OUTLAW CITY", 67, 195);
  ctx.fillStyle = titleGrad;
  ctx.fillText("OUTLAW CITY", 64, 192);
  ctx.restore();

  ctx.font = "700 25px " + HUD.font;
  ctx.fillStyle = HUD.c.text;
  ctx.fillText("亡命都市", 68, 232);
  ctx.fillStyle = HUD.c.red;
  ctx.font = "700 10px " + HUD.font;
  ctx.fillText("A CITY WITH NO CURFEW", 68, 254);
  ctx.fillStyle = HUD.c.muted;
  ctx.font = "600 13px " + HUD.font;
  ctx.fillText("黄昏降临，秩序退场。", 258, 253);

  const lg = ctx.createLinearGradient(64, 0, 486, 0);
  lg.addColorStop(0, "rgba(255, 194, 92, 0.95)");
  lg.addColorStop(1, "rgba(255, 194, 92, 0)");
  ctx.fillStyle = lg;
  ctx.fillRect(68, 276, 418, 1);
  ctx.fillStyle = HUD.c.amber;
  ctx.beginPath();
  ctx.moveTo(64, 272); ctx.lineTo(69, 276.5); ctx.lineTo(64, 281); ctx.lineTo(59, 276.5);
  ctx.closePath();
  ctx.fill();

  const stats = [["13×13", "城市街区"], ["07", "剧情合约"], ["24H", "昼夜循环"]];
  for (let i = 0; i < stats.length; i++) {
    const sx = 64 + i * 138;
    ctx.fillStyle = HUD.c.amber;
    ctx.font = "800 18px " + HUD.font;
    ctx.fillText(stats[i][0], sx, 308);
    ctx.fillStyle = HUD.c.dim;
    ctx.font = "600 9px " + HUD.font;
    ctx.fillText(stats[i][1], sx, 323);
    if (i) {
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(sx - 18, 292, 1, 28);
    }
  }

  const px = 64, py = 346, pw = 612, ph = 232;
  HUD.panel(ctx, px, py, pw, ph, "rgba(255, 194, 92, 0.78)");
  ctx.fillStyle = HUD.c.amber;
  ctx.font = "800 9px " + HUD.font;
  ctx.fillText("FIELD MANUAL  /  行动手册", px + 18, py + 22);
  ctx.textAlign = "right";
  ctx.fillStyle = HUD.c.dim;
  ctx.font = "600 8px " + HUD.mono;
  ctx.fillText("READ BEFORE YOU BURN IT", px + pw - 18, py + 22);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
  ctx.fillRect(px + 18, py + 31, pw - 36, 1);

  ctx.fillStyle = HUD.c.muted;
  ctx.font = "700 8px " + HUD.font;
  ctx.fillText("MOVEMENT / 移动", px + 18, py + 50);
  ctx.fillText("COMBAT / 战斗与系统", px + 330, py + 50);

  const rowsA = [
    ["WASD", "移动 · 驾驶"], ["SHIFT", "冲刺"], ["SPACE", "手刹 / 漂移"],
    ["鼠标", "视角 / 转向"], ["E", "互动 · 上下车"],
  ];
  const rowsB = [
    ["LMB", "射击 / 攻击"], ["RMB", "精确瞄准"], ["R", "换弹"],
    ["Q / 滚轮", "切换武器"], ["ESC", "暂停"],
  ];
  for (let i = 0; i < 5; i++) {
    menuRow(ctx, px + 18, py + 76 + i * 26, rowsA[i][0], rowsA[i][1]);
    menuRow(ctx, px + 330, py + 76 + i * 26, rowsB[i][0], rowsB[i][1]);
  }
  ctx.fillStyle = HUD.c.dim;
  ctx.font = "600 9px " + HUD.font;
  ctx.fillText("黄色 ? 接取任务   ·   绿色 $ 商店   ·   蓝色 H 医院", px + 18, py + ph - 12);

  const by = 596, bw = 360, bh = 52;
  const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(Date.now() * 0.004));
  ctx.save();
  ctx.shadowColor = "rgba(255, 170, 60, " + (0.18 + pulse * 0.16).toFixed(3) + ")";
  ctx.shadowBlur = 24;
  const bg = ctx.createLinearGradient(64, by, 64, by + bh);
  bg.addColorStop(0, "#ffd47a");
  bg.addColorStop(1, "#e99722");
  HUD.cut(ctx, 64, by, bw, bh, 9);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1;
  HUD.cut(ctx, 64.5, by + 0.5, bw - 1, bh - 1, 9);
  ctx.stroke();

  ctx.fillStyle = "rgba(18, 12, 5, 0.86)";
  HUD.cut(ctx, 80, by + 12, 74, 28, 4);
  ctx.fill();
  ctx.fillStyle = "#ffd47a";
  ctx.font = "800 10px " + HUD.font;
  ctx.textAlign = "center";
  ctx.fillText("ENTER", 117, by + 31);
  ctx.textAlign = "left";
  ctx.fillStyle = "#171006";
  ctx.font = "800 19px " + HUD.font;
  ctx.fillText("进入城市", 172, by + 33);
  ctx.fillStyle = "rgba(23, 16, 6, 0.70)";
  ctx.font = "800 18px " + HUD.font;
  ctx.textAlign = "right";
  ctx.fillText("→", 64 + bw - 22, by + 33);
  ctx.textAlign = "left";

  ctx.fillStyle = HUD.c.muted;
  ctx.font = "600 11px " + HUD.font;
  ctx.fillText("点击画面开始并锁定鼠标  ·  建议全屏游玩", 64, by + 76);
  ctx.fillStyle = HUD.c.dim;
  ctx.font = "600 10px " + HUD.font;
  ctx.fillText("WASD 移动    ·    E 互动    ·    ESC 暂停", 64, by + 96);

  ctx.textAlign = "right";
  ctx.fillStyle = HUD.c.dim;
  ctx.font = "600 9px " + HUD.font;
  ctx.fillText("OUTLAW CITY 3D  //  DUSK DISTRICT  //  BUILD 07", w - 64, h - 26);
  ctx.textAlign = "left";
}

function menuRow(ctx, x, y, key, label) {
  ctx.font = "700 9px " + HUD.font;
  const kw = Math.max(50, ctx.measureText(key).width + 18);
  HUD.cut(ctx, x, y - 13, kw, 20, 3);
  ctx.fillStyle = "rgba(255, 255, 255, 0.055)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 194, 92, 0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = HUD.c.amber;
  ctx.font = "700 9px " + HUD.font;
  ctx.textAlign = "center";
  ctx.fillText(key, x + kw / 2, y + 1);
  ctx.textAlign = "left";
  ctx.fillStyle = "#dce5ef";
  ctx.font = "600 11px " + HUD.font;
  ctx.fillText(label, x + kw + 10, y + 1);
}

function drawPause(ctx) {
  const w = W.viewW, h = W.viewH;
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.14, w / 2, h / 2, h * 0.88);
  g.addColorStop(0, "rgba(3, 7, 13, 0.72)");
  g.addColorStop(1, "rgba(2, 4, 8, 0.92)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const pw = 560, ph = 308, x = (w - pw) / 2, y = (h - ph) / 2;
  HUD.panel(ctx, x, y, pw, ph, "rgba(255, 194, 92, 0.78)");
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = HUD.c.red;
  ctx.fillRect(w / 2 - 184, y + 24, 3, 13);
  ctx.fillStyle = HUD.c.amber;
  ctx.font = "700 9px " + HUD.font;
  ctx.fillText("SESSION PAUSED  /  游戏时钟已冻结", w / 2, y + 34);
  ctx.fillStyle = HUD.c.text;
  ctx.font = "800 44px " + HUD.font;
  ctx.fillText("PAUSED", w / 2, y + 82);
  ctx.fillStyle = HUD.c.muted;
  ctx.font = "600 15px " + HUD.font;
  ctx.fillText("已暂停  ·  城市仍在呼吸", w / 2, y + 106);
  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  ctx.fillRect(x + 56, y + 124, pw - 112, 1);

  const p = W.player;
  if (p) {
    const items = [
      ["CASH", Utils.fmtMoney(p.money), HUD.c.green],
      ["LOCAL", HUD.timeText(), HUD.c.cyan],
      ["WANTED", (p.wanted | 0) > 0 ? "★ " + (p.wanted | 0) : "CLEAR", (p.wanted | 0) > 0 ? HUD.c.red : HUD.c.muted],
    ];
    for (let i = 0; i < items.length; i++) {
      const ix = x + 78 + i * 202;
      ctx.fillStyle = HUD.c.dim;
      ctx.font = "700 8px " + HUD.font;
      ctx.fillText(items[i][0], ix, y + 148);
      ctx.fillStyle = items[i][2];
      ctx.font = "800 17px " + HUD.font;
      ctx.fillText(items[i][1], ix, y + 169);
    }
  }

  HUD.cut(ctx, w / 2 - 160, y + 194, 320, 46, 6);
  ctx.fillStyle = "rgba(255, 194, 92, 0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 194, 92, 0.42)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = HUD.c.amber;
  ctx.font = "800 11px " + HUD.font;
  ctx.textAlign = "right";
  ctx.fillText("ESC", w / 2 - 108, y + 222);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(w / 2 - 86, y + 207, 1, 20);
  ctx.textAlign = "left";
  ctx.fillStyle = HUD.c.text;
  ctx.font = "700 16px " + HUD.font;
  ctx.fillText("继续游戏 / 点击画面", w / 2 - 68, y + 222);

  ctx.textAlign = "center";
  ctx.fillStyle = HUD.c.muted;
  ctx.font = "600 10px " + HUD.font;
  ctx.fillText("右键精确瞄准  ·  Shift 冲刺  ·  Space 手刹  ·  世界与任务计时已停止", w / 2, y + 272);
  ctx.fillStyle = HUD.c.dim;
  ctx.font = "700 8px " + HUD.font;
  ctx.fillText("OUTLAW CITY  //  DUSK DISTRICT", w / 2, y + 292);
  ctx.textAlign = "left";
}

function drawBigText(ctx, txt, color) {
  const w = W.viewW, h = W.viewH;
  const wasted = txt === "WASTED";
  const sec = Math.max(0, Math.ceil(W.stateTimer));
  const ratio = Utils.clamp(W.stateTimer / 3.5, 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(2, 4, 8, 0.78)");
  g.addColorStop(0.38, "rgba(4, 6, 12, 0.28)");
  g.addColorStop(0.62, "rgba(4, 6, 12, 0.28)");
  g.addColorStop(1, "rgba(2, 4, 8, 0.90)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(4, 8, 13, 0.58)";
  ctx.fillRect(0, h / 2 - 112, w, 224);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.65;
  ctx.fillRect(0, h / 2 - 112, w, 1);
  ctx.fillRect(0, h / 2 + 111, w, 1);
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.font = "700 11px " + HUD.font;
  ctx.fillText(wasted ? "MISSION FAILED  //  生命体征归零" : "ARRESTED  //  通缉解除", w / 2, h / 2 - 70);

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.font = "800 98px " + HUD.font;
  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.fillText(txt, w / 2 + 3, h / 2 + 20);
  ctx.fillStyle = color;
  ctx.fillText(txt, w / 2, h / 2 + 16);
  ctx.restore();

  ctx.font = "600 16px " + HUD.font;
  ctx.fillStyle = "#eef4fb";
  ctx.fillText(wasted ? "你被击倒了  //  城市仍在运转" : "你被逮捕了  //  罚款已扣除", w / 2, h / 2 + 50);

  ctx.fillStyle = "rgba(255, 255, 255, 0.13)";
  ctx.fillRect(w / 2 - 120, h / 2 + 66, 240, 3);
  ctx.fillStyle = color;
  ctx.fillRect(w / 2 - 120, h / 2 + 66, 240 * ratio, 3);

  ctx.fillStyle = HUD.c.muted;
  ctx.font = "600 12px " + HUD.font;
  ctx.fillText(wasted ? sec + " 秒后送入医院" : sec + " 秒后释放", w / 2, h / 2 + 90);
  ctx.fillStyle = HUD.c.dim;
  ctx.font = "600 9px " + HUD.font;
  ctx.fillText(wasted ? "HOSPITAL EMERGENCY  /  DOWNTOWN" : "POLICE PRECINCT  /  DUSK DISTRICT", w / 2, h / 2 + 110);
  ctx.textAlign = "left";
}
// 脚本在 body 末尾同步加载：DOM 已就绪时直接启动，避免错过 DOMContentLoaded 导致黑屏
if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot);
else boot();
