"use strict";
const W = {
  viewW: 1280, viewH: 720,
  player: null, vehicles: [], npcs: [], pickups: [],
  gameTime: 0, cam: { x: 0, y: 0 },
  state: "menu", stateTimer: 0,
  prompt: null, notifs: [], damageFlash: 0,
  lastGunshot: null,
  stats: { kills: 0, moneyEarned: 0, carsStolen: 0 },
  mapW: 0, mapH: 0,
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
  W.state = "busted";
  W.stateTimer = 3.5;
  const fine = Math.floor(p.money * 0.1);
  p.money -= fine;
  W.notify("你被逮捕了，罚款 $" + fine, "#f87171");
  Missions.onPlayerDied();
};
function boot() {
  const glCanvas = document.getElementById("game3d");
  const hudCanvas = document.getElementById("hud");
  if (!glCanvas || !hudCanvas) return;
  W.ctx = hudCanvas.getContext("2d");
  W.viewW = hudCanvas.width; W.viewH = hudCanvas.height;
  Input.init(hudCanvas);
  AudioSys.init();
  MapSys.use2DChunks = false;
  MapSys.init();
  W.mapW = MapSys.data.worldW; W.mapH = MapSys.data.worldH;
  Render3D.init(glCanvas, W.viewW, W.viewH);
  Input.onLockChange = function (locked) {
    if (!locked && W.state === "play") { W.state = "paused"; W.notify("按 Esc 或点击画面继续", "#94a3b8"); }
  };
  PoliceSys.init();
  Missions.init();
  initWorld();
  requestAnimationFrame(loop);
}
function initWorld() {
  W.player = new Player(W.hospital.x, W.hospital.y);
  for (let i = 0; i < 12; i++) {
    const pt = MapSys.randomWalkablePoint();
    W.npcs.push(new NPC("civilian", pt.x, pt.y));
  }
  for (let i = 0; i < 12; i++) spawnTraffic();
  const pts = [MapSys.cellCenter(3, 3), MapSys.cellCenter(7, 5), MapSys.cellCenter(11, 9), MapSys.cellCenter(5, 5), MapSys.cellCenter(8, 8), MapSys.cellCenter(2, 6)];
  W.pickups.push(new Pickup("health", pts[0].x, pts[0].y));
  W.pickups.push(new Pickup("armor", pts[1].x, pts[1].y));
  W.pickups.push(new Pickup("ammo", pts[2].x, pts[2].y));
  W.pickups.push(new Pickup("money", pts[3].x, pts[3].y, 200));
  W.pickups.push(new Pickup("health", pts[4].x, pts[4].y));
  W.pickups.push(new Pickup("armor", pts[5].x, pts[5].y));
  W.cam.x = W.hospital.x - W.viewW / 2;
  W.cam.y = W.hospital.y - W.viewH / 2;
}
function spawnTraffic() {
  const rp = MapSys.randomRoadPoint();
  const types = ["sedan", "sedan", "sedan", "sports", "taxi", "truck", "bike"];
  const type = Utils.choice(types);
  const heading = rp.axis === "v" ? (rp.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (rp.dir > 0 ? 0 : Math.PI);
  const v = new Vehicle(type, rp.x, rp.y, heading);
  v.ai = makeTrafficAI(v, { axis: rp.axis, x: rp.x, y: rp.y, dir: rp.dir, lane: rp.lane });
  W.vehicles.push(v);
}
function mouseWorld() {
  return Render3D.aimPoint();
}
function update(dt) {
  W.gameTime += dt;
  W.damageFlash = Math.max(0, W.damageFlash - dt * 2);
  const p = W.player;
  if (W.lastGunshot) { W.lastGunshot.t -= dt; if (W.lastGunshot.t <= 0) W.lastGunshot = null; }
  if (Input.consume("KeyQ")) p.cycleWeapon(-1);
  for (let i = 0; i < p.weapons.length; i++) {
    if (Input.consume("Digit" + (i + 1))) p.equip(i);
  }
  if (Input.wheel !== 0) p.cycleWeapon(Input.wheel > 0 ? 1 : -1);
  if (Input.consume("KeyR")) p.startReload();
  if (Input.keys.Equal || Input.keys.NumpadAdd) Render3D.zoomD = Math.max(12, Render3D.zoomD - 8 * dt);
  if (Input.keys.Minus || Input.keys.NumpadSubtract) Render3D.zoomD = Math.min(34, Render3D.zoomD + 8 * dt);
  // 鼠标控制视角：Pointer Lock 锁定后移动鼠标转动；未锁定时光标偏离中心来转向
  if (Input.locked) {
    if (Input.dx !== 0 || Input.dy !== 0) Render3D.rotateCam(Input.dx * 0.0026, Input.dy * 0.0026);
  } else {
    const ox = Input.mouse.x - W.viewW / 2, oy = Input.mouse.y - W.viewH / 2;
    if (Math.abs(ox) > 40 || Math.abs(oy) > 40) Render3D.rotateCam(ox * 0.0016, oy * 0.0016);
  }
  Input.dx = 0; Input.dy = 0;
  p.updateReload(dt);
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  p.muzzleT = Math.max(0, p.muzzleT - dt);
  p.meleeSwing = Math.max(0, p.meleeSwing - dt * 4);
  p.dmgFlash = Math.max(0, p.dmgFlash - dt * 3);
  const mw = mouseWorld();
  p.aim = Utils.angleTo(p.x, p.y, mw.x, mw.y);
  if (p.vehicle) {
    if (Input.consume("KeyE")) exitVehicle();
    if (Input.mouse.down) playerShoot(true);
    AudioSys.engineUpdate(Math.abs(p.vehicle.fs) / p.vehicle.def.maxSpeed);
  } else {
    playerFootUpdate(dt);
    if (Input.consume("KeyE")) tryInteract();
    if (Input.mouse.down) playerShoot(false);
  }
  for (const v of W.vehicles) v.update(dt);
  if (p.vehicle) { p.x = p.vehicle.x; p.y = p.vehicle.y; }
  for (const n of W.npcs) n.update(dt);
  PoliceSys.update(dt);
  Missions.update(dt);
  Combat.update(dt);
  for (const pk of W.pickups) pk.update(dt);
  W.pickups = W.pickups.filter(pk => !pk.dead);
  W.spawnCd -= dt;
  if (W.spawnCd <= 0) {
    W.spawnCd = 2.5;
    const cars = W.vehicles.filter(v => v.ai && !v.ai.police && !v.ai.escort).length;
    if (cars < 14) spawnTraffic();
  }
  W.pedCd -= dt;
  if (W.pedCd <= 0) {
    W.pedCd = 1.2;
    const civs = W.npcs.filter(n => n.type === "civilian").length;
    if (civs < 22) {
      const pt = MapSys.randomWalkablePoint();
      W.npcs.push(new NPC("civilian", pt.x, pt.y));
    }
  }
  updateCamera(dt);
  updatePrompt();
}
function playerFootUpdate(dt) {
  const p = W.player;
  const k = Input.keys;
  let mx = 0, my = 0;
  if (k.KeyW || k.ArrowUp) my -= 1;
  if (k.KeyS || k.ArrowDown) my += 1;
  if (k.KeyA || k.ArrowLeft) mx -= 1;
  if (k.KeyD || k.ArrowRight) mx += 1;
  if (mx || my) {
    // 屏幕方向移动：W=屏幕上方，S=下方，A/D=左右（固定镜头下与 2D 手感一致）
    const sv = Render3D.screenVecs();
    let wx = sv.rx * mx + sv.ux * (-my);
    let wz = sv.rz * mx + sv.uz * (-my);
    const wl = Utils.hypot(wx, wz) || 1;
    wx /= wl; wz /= wl;
    const sp = (k.ShiftLeft || k.ShiftRight) ? CFG.PLAYER.sprint : CFG.PLAYER.speed;
    p.x += wx * sp * dt;
    p.y += wz * sp * dt;
    p.heading = Utils.angleLerp(p.heading, Math.atan2(wz, wx), 8 * dt);
    const res = MapSys.resolve(p.x, p.y, CFG.PLAYER.radius, { x: p.x, y: p.y });
    p.x = res.x; p.y = res.y;
  }
}
function playerVehicleControl(dt) {
  const k = Input.keys;
  let throttle = 0, steer = 0;
  if (k.KeyW || k.ArrowUp) throttle += 1;
  if (k.KeyS || k.ArrowDown) throttle -= 1;
  if (k.KeyA || k.ArrowLeft) steer -= 1;
  if (k.KeyD || k.ArrowRight) steer += 1;
  return { throttle: throttle, steer: steer, brake: false, handbrake: !!(k.Space) };
}
function playerShoot(fromCar) {
  const p = W.player;
  if (Input.suppressShot) { Input.suppressShot = false; return; }
  const w = p.weapon();
  const def = CFG.WEAPONS[w];
  if (p.reloading || p.fireTimer > 0 || p.dead) return;
  if (def.melee) {
    p.fireTimer = 1 / def.rate;
    p.meleeSwing = 1;
    Combat.fireWeapon("player", w, p.x, p.y, p.aim);
    return;
  }
  if (p.mag[w] <= 0) { if (p.ammo[w] > 0) p.startReload(); return; }
  p.fireTimer = 1 / def.rate;
  let ox = p.x, oy = p.y;
  if (fromCar && p.vehicle) {
    ox = p.vehicle.x + Math.cos(p.vehicle.heading) * p.vehicle.def.h * 0.45;
    oy = p.vehicle.y + Math.sin(p.vehicle.heading) * p.vehicle.def.h * 0.45;
  }
  Combat.fireWeapon("player", w, ox, oy, p.aim);
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
  p.vehicle = v; v.driver = p;
  p.x = v.x; p.y = v.y;
  W.stats.carsStolen++;
  if (v.type === "police") { W.addWanted(1); W.notify("你偷了一辆警车！", "#f87171"); }
  AudioSys.engineStart();
  AudioSys.horn();
}
function exitVehicle() {
  const p = W.player, v = p.vehicle;
  if (!v) return;
  v.driver = null; p.vehicle = null;
  p.x = v.x + Math.cos(v.heading + Math.PI / 2) * (v.radius + 16);
  p.y = v.y + Math.sin(v.heading + Math.PI / 2) * (v.radius + 16);
  const res = MapSys.resolve(p.x, p.y, CFG.PLAYER.radius, { x: p.x, y: p.y });
  p.x = res.x; p.y = res.y;
  AudioSys.engineStop();
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
function updateCamera(dt) {
  const p = W.player;
  const tx = p.vehicle ? p.vehicle.x : p.x;
  const ty = p.vehicle ? p.vehicle.y : p.y;
  const k = 1 - Math.exp(-4.5 * dt);
  W.cam.x = Utils.lerp(W.cam.x, tx - W.viewW / 2, k);
  W.cam.y = Utils.lerp(W.cam.y, ty - W.viewH / 2, k);
  W.cam.x = Utils.clamp(W.cam.x, -80, W.mapW - W.viewW + 80);
  W.cam.y = Utils.clamp(W.cam.y, -80, W.mapH - W.viewH + 80);
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
  p.health = CFG.PLAYER.health;
  p.armor = 0;
  p.dead = false;
  p.ammo = {};
  for (const k in CFG.START_AMMO) p.ammo[k] = Math.floor(CFG.START_AMMO[k] * 0.6);
  for (const k of p.weapons) p.mag[k] = 0;
  p.mag.pistol = CFG.WEAPONS.pistol.mag;
  p.reloading = false;
  W.state = "play";
}
let lastT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) dt = 0.016;
  if (W.state === "play") {
    if (Input.consume("Escape")) W.state = "paused";
    else update(dt);
  } else if (W.state === "paused") {
    if (Input.consume("Escape") || Input.mouse.down) {
      W.state = "play";
      Input.mouse.down = false;
    }
  } else if (W.state === "menu") {
    AudioSys.resume();
    if (Input.consume("Enter") || Input.consume("NumpadEnter")) {
      W.state = "play";
      AudioSys.missionStart();
      W.notify("自由探索！前往黄色 ? 标记接取任务", "#fde68a");
    }
  } else {
    W.stateTimer -= dt;
    if (W.stateTimer <= 0) respawn();
  }
  for (const n of W.notifs) n.t -= dt;
  W.notifs = W.notifs.filter(n => n.t > 0);
  Input.clearPressed();
  render(dt);
}
function render(dt) {
  Render3D.update(dt);
  const ctx = W.ctx;
  ctx.clearRect(0, 0, W.viewW, W.viewH);
  HUD.draw(ctx);
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
function drawHeadlights(ctx, v, light) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.heading);
  const a = (0.5 - light) * 0.8;
  const g = ctx.createLinearGradient(0, 0, 300, 0);
  g.addColorStop(0, "rgba(255,240,180," + a + ")");
  g.addColorStop(1, "rgba(255,240,180,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(20, -10);
  ctx.lineTo(320, -70);
  ctx.lineTo(320, 70);
  ctx.lineTo(20, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function drawSunMoon(ctx, light) {
  const h = HUD.hour();
  const x = W.viewW - 60;
  let y;
  if (h >= 6 && h <= 18) {
    y = Utils.lerp(W.viewH + 40, 40, (h - 6) / 12);
    ctx.fillStyle = "#fde047";
  } else {
    y = Utils.lerp(W.viewH + 40, 40, ((h - 18 + 24) % 24) / 12);
    ctx.fillStyle = "#e2e8f0";
  }
  ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
}
function drawMenu(ctx) {
  ctx.fillStyle = "rgba(5,8,18,0.92)";
  ctx.fillRect(0, 0, W.viewW, W.viewH);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f59e0b";
  ctx.font = "bold 64px 'Segoe UI', sans-serif";
  ctx.fillText("亡命都市", W.viewW / 2, 170);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "20px 'Segoe UI', sans-serif";
  ctx.fillText("OUTLAW CITY 3D — GTA 风格 3D 开放世界犯罪动作游戏", W.viewW / 2, 212);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "16px 'Segoe UI', sans-serif";
  let y = 290;
  const lines = [
    "WASD / 方向键 移动（按镜头方向）   Shift 奔跑",
    "点击画面锁定鼠标，移动鼠标转动视角（准星固定屏幕中央）",
    "左键射击   R 换弹   Q / 滚轮 / 1-6 切换武器   Esc 解锁并暂停",
    "E 上车 / 下车 / 接任务   空格 漂移",
    "开车：W/S 加速刹车，A/D 转向   + / - 拉近拉远镜头",
    "地图上的黄色 ? 为剧情任务，绿色 T 为出租车生意",
  ];
  for (const L of lines) { ctx.fillText(L, W.viewW / 2, y); y += 30; }
  ctx.fillStyle = "#4ade80";
  ctx.font = "bold 26px 'Segoe UI', sans-serif";
  ctx.fillText("按 Enter 开始游戏", W.viewW / 2, y + 40);
  ctx.fillStyle = "#64748b";
  ctx.font = "14px 'Segoe UI', sans-serif";
  ctx.fillText("剧情：新手上路 → 城市出租 → 帮派清剿 → 追捕逃犯 → 定时炸弹 → 枭雄陨落 → 终极对决", W.viewW / 2, y + 78);
  ctx.textAlign = "left";
}
function drawPause(ctx) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W.viewW, W.viewH);
  ctx.textAlign = "center";
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 44px 'Segoe UI', sans-serif";
  ctx.fillText("已暂停", W.viewW / 2, W.viewH / 2 - 10);
  ctx.font = "18px 'Segoe UI', sans-serif";
  ctx.fillText("按 Esc 或点击画面继续（点击会重新锁定鼠标）", W.viewW / 2, W.viewH / 2 + 30);
  ctx.textAlign = "left";
}
function drawBigText(ctx, txt, color) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W.viewW, W.viewH);
  ctx.textAlign = "center";
  ctx.font = "bold 90px 'Segoe UI', sans-serif";
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.fillText(txt, W.viewW / 2, W.viewH / 2);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}
window.addEventListener("DOMContentLoaded", boot);
