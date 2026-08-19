"use strict";
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.heading = 0; this.aim = 0;
    this.health = CFG.PLAYER.health; this.armor = CFG.PLAYER.armor;
    this.money = CFG.START_MONEY;
    this.weapons = CFG.WEAPON_ORDER.slice();
    this.weaponIndex = 0;
    this.ammo = {};
    for (const k in CFG.START_AMMO) this.ammo[k] = CFG.START_AMMO[k];
    this.mag = {};
    for (const k of this.weapons) this.mag[k] = 0;
    this.mag.pistol = 12;
    this.vehicle = null;
    this.fireTimer = 0; this.reloadTimer = 0; this.reloading = false;
    this.dead = false;
    this.wanted = 0;
    this.muzzleT = 0; this.meleeSwing = 0;
    this.dmgFlash = 0;
  }
  weapon() { return this.weapons[this.weaponIndex]; }
  equip(i) {
    if (i < 0 || i >= this.weapons.length || i === this.weaponIndex) return;
    this.weaponIndex = i;
    const w = this.weapon(), def = CFG.WEAPONS[w];
    if (!def.melee && this.mag[w] <= 0 && this.ammo[w] > 0) { this.reloading = true; this.reloadTimer = 0.4; }
  }
  cycleWeapon(d) {
    let i = this.weaponIndex + d;
    i = (i + this.weapons.length) % this.weapons.length;
    this.equip(i);
  }
  startReload() {
    const w = this.weapon(), def = CFG.WEAPONS[w];
    if (def.melee || this.reloading || this.dead) return;
    if (this.mag[w] >= def.mag || this.ammo[w] <= 0) return;
    this.reloading = true; this.reloadTimer = def.reload;
  }
  updateReload(dt) {
    if (!this.reloading) return;
    this.reloadTimer -= dt;
    if (this.reloadTimer <= 0) {
      const w = this.weapon(), def = CFG.WEAPONS[w];
      const need = def.mag - this.mag[w];
      const take = Math.min(need, this.ammo[w]);
      this.mag[w] += take; this.ammo[w] -= take;
      this.reloading = false;
      AudioSys.pickup();
    }
  }
  damage(amount, src) {
    if (this.dead) return;
    let a = amount;
    if (this.armor > 0) { const ab = Math.min(this.armor, a); this.armor -= ab; a -= ab; }
    this.health -= a;
    this.dmgFlash = 1;
    W.damageFlash = 1;
    if (this.health <= 0) { this.health = 0; W.onPlayerKilled(src); }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.arc(2, 3, CFG.PLAYER.radius + 1, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(this.heading);
    ctx.fillStyle = this.dmgFlash > 0.2 ? "#ffffff" : "#3b82f6";
    ctx.beginPath(); ctx.arc(0, 0, CFG.PLAYER.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1e3a8a";
    ctx.beginPath(); ctx.arc(CFG.PLAYER.radius * 0.45, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(this.aim - this.heading);
    const w = this.weapon();
    if (w !== "fist") {
      ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(16, 0); ctx.stroke();
    }
    if (this.muzzleT > 0) {
      ctx.fillStyle = "rgba(255,220,90,0.9)";
      ctx.beginPath(); ctx.arc(21, 0, 6, 0, Math.PI * 2); ctx.fill();
    }
    if (this.meleeSwing > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(10, 0, 22, -0.9, 0.9); ctx.stroke();
    }
    ctx.restore();
  }
}
class Vehicle {
  constructor(type, x, y, heading, opts) {
    opts = opts || {};
    this.type = type; this.def = CFG.VEHICLES[type];
    this.x = x; this.y = y; this.heading = heading || 0;
    this.vx = 0; this.vy = 0; this.fs = 0;
    this.health = opts.health || this.def.health;
    this.color = opts.color || Utils.choice(this.def.colors);
    this.driver = null;
    this.ai = opts.ai || null;
    this.wrecked = false; this.onFire = false;
    this.siren = !!opts.siren;
    this.damageFlash = 0;
    this.tag = opts.tag || null;
  }
  get radius() { return Math.max(this.def.w, this.def.h) * 0.42; }
  update(dt) {
    if (this.wrecked) {
      if (this.onFire && Math.random() < dt * 7) Combat.spawnFire(this.x + Utils.rand(-12, 12), this.y + Utils.rand(-12, 12));
      return;
    }
    let ctrl;
    if (this.driver === W.player) ctrl = playerVehicleControl(dt);
    else if (this.ai) ctrl = this.ai.control(dt);
    else ctrl = { throttle: 0, steer: 0, brake: false, handbrake: false };
    const def = this.def;
    this.fs += ctrl.throttle * def.accel * dt;
    this.fs -= this.fs * 0.12 * dt;
    const maxR = def.maxSpeed * 0.38;
    this.fs = Utils.clamp(this.fs, -maxR, def.maxSpeed);
    const speedFactor = Utils.clamp(Math.abs(this.fs) / def.maxSpeed, 0, 1);
    this.heading += ctrl.steer * def.turn * dt * (0.2 + 0.8 * speedFactor);
    const fx = Math.cos(this.heading), fy = Math.sin(this.heading);
    const targetVX = fx * this.fs, targetVY = fy * this.fs;
    const grip = ctrl.handbrake ? 2.2 : 7.5;
    const k = 1 - Math.exp(-grip * dt);
    this.vx = Utils.lerp(this.vx, targetVX, k);
    this.vy = Utils.lerp(this.vy, targetVY, k);
    this.x += this.vx * dt; this.y += this.vy * dt;
    const speed = Utils.hypot(this.vx, this.vy);
    const res = MapSys.resolve(this.x, this.y, this.radius, { x: this.x, y: this.y });
    if (res.hit) {
      const dx = this.x - res.x, dy = this.y - res.y;
      const dd = Utils.hypot(dx, dy) || 1;
      const dot = (this.vx * dx + this.vy * dy) / dd;
      if (dot < 0) { this.vx -= (dx / dd) * dot * 1.4; this.vy -= (dy / dd) * dot * 1.4; }
      this.x = res.x; this.y = res.y;
      if (speed > 90) {
        if (this.driver === W.player) {
          this.damage((speed - 60) * 0.5, "collision");
          Combat.shake += Math.min(6, speed * 0.02);
        }
        Combat.spawnSparks(this.x, this.y, 4);
      }
    }
    for (const o of W.vehicles) {
      if (o === this || o.wrecked) continue;
      const rr = this.radius + o.radius;
      const dx = o.x - this.x, dy = o.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.001) {
        const d = Math.sqrt(d2); const nx = dx / d, ny = dy / d;
        const overlap = rr - d;
        this.x -= nx * overlap * 0.5; this.y -= ny * overlap * 0.5;
        o.x += nx * overlap * 0.5; o.y += ny * overlap * 0.5;
        const rel = (this.vx - o.vx) * nx + (this.vy - o.vy) * ny;
        if (rel > 0) {
          const imp = rel * 0.9;
          this.vx -= nx * imp; this.vy -= ny * imp;
          o.vx += nx * imp; o.vy += ny * imp;
          const dmg = rel * 0.35;
          this.damage(dmg, "collision"); o.damage(dmg, "collision");
          if (rel > 120) Combat.spawnSparks((this.x + o.x) / 2, (this.y + o.y) / 2, 4);
        }
      }
    }
    for (const n of W.npcs) {
      if (n.dead) continue;
      const rr = this.radius + 9;
      if (Utils.dist2(this.x, this.y, n.x, n.y) < rr * rr && this.fs > 40) {
        n.damage(999, this.driver === W.player ? "player" : "ai");
        Combat.spawnBlood(n.x, n.y, 10);
        this.fs *= 0.94;
      }
    }
    if (W.player && !W.player.dead && !W.player.vehicle) {
      const pd = Utils.dist(this.x, this.y, W.player.x, W.player.y);
      if (pd < this.radius + 13 && this.fs > 55) {
        W.player.damage(8, "enemy");
        const a = Utils.angleTo(this.x, this.y, W.player.x, W.player.y);
        W.player.x += Math.cos(a) * 40 * dt * 10;
        W.player.y += Math.sin(a) * 40 * dt * 10;
        Combat.shake += 3;
      }
    }
    if (this.health < this.def.health * 0.35 && !this.onFire) this.onFire = true;
    if (this.onFire && Math.random() < dt * 8) Combat.spawnFire(this.x + Utils.rand(-10, 10), this.y + Utils.rand(-10, 10));
    if (this.health <= 0) this.explode();
    if (this.damageFlash > 0) this.damageFlash -= dt * 3;
  }
  damage(amount, src) {
    if (this.wrecked) return;
    this.health -= amount;
    this.damageFlash = 1;
    if (this.health <= 0) this.explode();
  }
  explode() {
    if (this.wrecked) return;
    this.wrecked = true;
    const ex = this.x + Math.cos(this.heading) * this.def.h * 0.5;
    const ey = this.y + Math.sin(this.heading) * this.def.h * 0.5;
    const big = this.type === "truck";
    Combat.explode(ex, ey, big ? 175 : 125, big ? 200 : 150, this.driver === W.player ? "player" : "ai");
    if (this.driver === W.player) {
      W.player.vehicle = null; this.driver = null;
      W.player.x = this.x; W.player.y = this.y;
      W.addWanted(1);
      W.notify("你的车辆爆炸了！");
      AudioSys.engineStop();
    }
    if (this.ai && this.ai.onWreck) this.ai.onWreck();
    if (this.siren) {
      for (const n of W.npcs) if (n.police && n.car === this) n.damage(999, "explosion");
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.heading);
    const w = this.def.w, h = this.def.h;
    if (this.wrecked) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#191919";
      this.box(ctx, -w / 2, -h / 2, w, h, 7);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    this.box(ctx, -w / 2 + 3, -h / 2 + 5, w, h, 7);
    ctx.fillStyle = "#111318";
    this.box(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 6);
    ctx.fillStyle = this.damageFlash > 0 ? "#ffffff" : this.color;
    this.box(ctx, -w / 2, -h / 2, w, h, 7);
    ctx.fillStyle = "rgba(20,40,60,0.9)";
    this.box(ctx, -w * 0.18, -h / 2 + 4, w * 0.36, h * 0.18, 3);
    this.box(ctx, -w * 0.18, h / 2 - h * 0.2, w * 0.36, h * 0.16, 3);
    if (this.siren) {
      const fl = Math.floor(W.gameTime * 5) % 2;
      ctx.fillStyle = fl ? "#ef4444" : "#3b82f6";
      this.box(ctx, -3, -h / 2 - 5, 6, 5, 2);
    }
    if (this.driver) {
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  box(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }
}
class NPC {
  constructor(type, x, y, opts) {
    opts = opts || {};
    this.type = type;
    const def = CFG.NPC[type] || CFG.NPC.civilian;
    this.health = def.health;
    this.speed = def.speed * Utils.rand(0.85, 1.15);
    this.x = x; this.y = y;
    this.heading = Utils.rand(0, Math.PI * 2);
    this.aimAngle = this.heading;
    this.state = "wander";
    this.tx = x; this.ty = y;
    this.fireTimer = Utils.rand(0.5, 1.5);
    this.dead = false; this.deathTimer = 0;
    this.clothes = Utils.choice(["#e2e8f0", "#fda4af", "#93c5fd", "#fcd34d", "#86efac", "#c4b5fd"]);
    this.gang = type === "gang";
    this.police = type === "police";
    this.boss = type === "boss";
    this.car = opts.car || null;
    this.tag = opts.tag || null;
    this.meleeCd = 0;
    this.dmgFlash = 0;
    this.dropsMoney = type === "civilian" || type === "gang";
    this.fleeFrom = null;
  }
  get weapon() {
    if (this.police || this.boss) return "pistol";
    if (this.gang) return "smg";
    return null;
  }
  update(dt) {
    if (this.dead) { this.deathTimer += dt; return; }
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 4);
    if ((this.gang || this.boss) && W.player && !W.player.dead) {
      if (Utils.dist(this.x, this.y, W.player.x, W.player.y) < 360 && this.state !== "attack") this.state = "attack";
    }
    switch (this.state) {
      case "wander": {
        const dx = this.tx - this.x, dy = this.ty - this.y;
        const d = Utils.hypot(dx, dy);
        if (d < 8) {
          this.tx = this.x + Utils.rand(-140, 140); this.ty = this.y + Utils.rand(-140, 140);
        } else {
          this.heading = Utils.angleLerp(this.heading, Utils.angleTo(this.x, this.y, this.tx, this.ty), 3 * dt);
          this.x += Math.cos(this.heading) * this.speed * dt;
          this.y += Math.sin(this.heading) * this.speed * dt;
          const res = MapSys.resolve(this.x, this.y, 8, { x: this.x, y: this.y });
          this.x = res.x; this.y = res.y;
        }
        if (W.lastGunshot && Utils.dist(this.x, this.y, W.lastGunshot.x, W.lastGunshot.y) < 230 && Math.random() < dt * 3) {
          this.state = "flee";
          this.fleeFrom = { x: W.lastGunshot.x, y: W.lastGunshot.y };
        }
        break;
      }
      case "flee": {
        const a = Utils.angleTo(this.x, this.y, this.fleeFrom.x, this.fleeFrom.y);
        this.heading = Utils.angleLerp(this.heading, a + Math.PI, 4 * dt);
        this.x += Math.cos(this.heading) * this.speed * 1.6 * dt;
        this.y += Math.sin(this.heading) * this.speed * 1.6 * dt;
        const res = MapSys.resolve(this.x, this.y, 8, { x: this.x, y: this.y });
        this.x = res.x; this.y = res.y;
        if (Utils.dist(this.x, this.y, this.fleeFrom.x, this.fleeFrom.y) > 340) this.state = "wander";
        break;
      }
      case "chase": {
        const p = W.player;
        const d = Utils.dist(this.x, this.y, p.x, p.y);
        if (d < 260) { this.state = "attack"; break; }
        this.heading = Utils.angleLerp(this.heading, Utils.angleTo(this.x, this.y, p.x, p.y), 4 * dt);
        this.x += Math.cos(this.heading) * this.speed * 1.4 * dt;
        this.y += Math.sin(this.heading) * this.speed * 1.4 * dt;
        const res = MapSys.resolve(this.x, this.y, 8, { x: this.x, y: this.y });
        this.x = res.x; this.y = res.y;
        break;
      }
      case "attack": {
        const p = W.player;
        if (!p || p.dead) { this.state = "wander"; break; }
        const d = Utils.dist(this.x, this.y, p.x, p.y);
        this.aimAngle = Utils.angleTo(this.x, this.y, p.x, p.y);
        this.heading = Utils.angleLerp(this.heading, this.aimAngle, 4 * dt);
        if (d > 300) {
          this.x += Math.cos(this.heading) * this.speed * dt;
          this.y += Math.sin(this.heading) * this.speed * dt;
        } else if (d < 110) {
          this.x -= Math.cos(this.heading) * this.speed * 0.5 * dt;
          this.y -= Math.sin(this.heading) * this.speed * 0.5 * dt;
        }
        const res = MapSys.resolve(this.x, this.y, 8, { x: this.x, y: this.y });
        this.x = res.x; this.y = res.y;
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && d < 430 && p.health > 0) {
          const spread = this.police ? 0.05 + W.police.level * 0.035 : 0.16;
          Combat.enemyShot(this, spread);
          this.fireTimer = 1.0 + Utils.rand(0, 0.5);
        }
        break;
      }
    }
  }
  damage(amount, src) {
    if (this.dead) return;
    this.health -= amount;
    this.dmgFlash = 1;
    Combat.spawnBlood(this.x, this.y, Math.min(8, Math.ceil(amount * 0.15)));
    if (this.health <= 0) {
      this.dead = true; this.deathTimer = 0;
      if (this.dropsMoney && Math.random() < 0.4) W.pickups.push(new Pickup("money", this.x, this.y, Utils.randInt(40, 220)));
      if (src === "player") {
        W.stats.kills++;
        if (this.type === "civilian") W.addWanted(1);
        if (this.police) W.addWanted(1);
        if (Missions.current) Missions.onNpcKilled(this);
      }
      if (this.type === "boss" && Missions.current) Missions.onNpcKilled(this);
      AudioSys.blood();
    } else if (src === "player" && this.type === "civilian") {
      this.state = "flee"; this.fleeFrom = { x: this.x, y: this.y };
    }
  }
  draw(ctx) {
    if (this.dead) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.heading);
      ctx.globalAlpha = Math.max(0, 1 - this.deathTimer / 18);
      ctx.fillStyle = "#7f1d1d";
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.arc(1, 2, 7, 0, Math.PI * 2); ctx.fill();
    let bodyC = this.dmgFlash > 0 ? "#ffffff" : this.clothes;
    if (this.police) bodyC = this.dmgFlash > 0 ? "#ffffff" : "#1e3a8a";
    if (this.gang) bodyC = this.dmgFlash > 0 ? "#ffffff" : "#7f1d1d";
    if (this.boss) bodyC = this.dmgFlash > 0 ? "#ffffff" : "#f8fafc";
    ctx.fillStyle = bodyC;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#eab308";
    ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, Math.PI * 2); ctx.fill();
    if (this.state === "attack" || this.police) {
      ctx.save();
      ctx.rotate(this.aimAngle);
      ctx.strokeStyle = "#111"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(13, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}
class Pickup {
  constructor(type, x, y, value) {
    this.type = type; this.x = x; this.y = y; this.value = value || 0;
    this.t = Math.random() * 10;
    this.dead = false;
  }
  update(dt) {
    this.t += dt;
    const p = W.player;
    if (!p.dead && Utils.dist(this.x, this.y, p.x, p.y) < 26) this.collect();
  }
  collect() {
    if (this.dead) return;
    this.dead = true;
    const p = W.player;
    if (this.type === "money") { p.money += this.value; W.stats.moneyEarned += this.value; AudioSys.money(); W.notify("+$" + this.value, "#4ade80"); }
    else if (this.type === "health") { p.health = Math.min(CFG.PLAYER.health, p.health + 50); AudioSys.pickup(); W.notify("+50 生命", "#4ade80"); }
    else if (this.type === "armor") { p.armor = Math.min(CFG.PLAYER.armor, p.armor + 50); AudioSys.pickup(); W.notify("+50 护甲", "#38bdf8"); }
    else if (this.type === "ammo") {
      for (const k of ["pistol", "smg", "shotgun", "rifle"]) p.ammo[k] += 30;
      p.ammo.rocket += 3;
      AudioSys.pickup(); W.notify("弹药补充", "#fbbf24");
    }
  }
  draw(ctx) {
    const bob = Math.sin(this.t * 3) * 3;
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.arc(0, 4, 10, 0, Math.PI * 2); ctx.fill();
    const c = this.type === "money" ? "#16a34a" : this.type === "health" ? "#dc2626" : this.type === "armor" ? "#0ea5e9" : "#eab308";
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.type === "money" ? "$" : this.type === "health" ? "+" : this.type === "armor" ? "A" : "M", 0, 4);
    ctx.textAlign = "left";
    ctx.restore();
  }
}
