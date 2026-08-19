"use strict";
const Combat = {
  bullets: [], particles: [], shake: 0,
  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 24);
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) { this.bullets.splice(i, 1); continue; }
      if (MapSys.isBlocked(b.x, b.y)) { this.spawnSparks(b.x, b.y, 3); this.bullets.splice(i, 1); continue; }
      let hit = false;
      if (b.team === "player") {
        for (const n of W.npcs) {
          if (n.dead) continue;
          if (Utils.dist2(b.x, b.y, n.x, n.y) < 14 * 14) { n.damage(b.dmg, "player"); this.spawnBlood(b.x, b.y, 3); hit = true; break; }
        }
        if (!hit) for (const v of W.vehicles) {
          if (v.wrecked || v.driver === W.player) continue;
          if (Utils.dist2(b.x, b.y, v.x, v.y) < (v.radius + 4) * (v.radius + 4)) { v.damage(b.dmg, "player"); this.spawnSparks(b.x, b.y, 3); hit = true; break; }
        }
      } else {
        if (!W.player.dead) {
          const tgt = W.player.vehicle ? W.player.vehicle : W.player;
          const rr = W.player.vehicle ? W.player.vehicle.radius : CFG.PLAYER.radius;
          if (Utils.dist2(b.x, b.y, tgt.x, tgt.y) < (rr + 5) * (rr + 5)) {
            if (W.player.vehicle) W.player.vehicle.damage(b.dmg, "enemy");
            else W.player.damage(b.dmg, "enemy");
            hit = true;
          }
        }
      }
      if (hit) this.bullets.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += p.grav * dt;
      if (p.type === "smoke" || p.type === "fire") p.vx *= (1 - 2 * dt);
      if (p.type === "spark") { p.vx *= (1 - 3 * dt); p.vy *= (1 - 3 * dt); }
    }
  },
  fireWeapon(team, weaponName, ox, oy, angle) {
    const def = CFG.WEAPONS[weaponName];
    if (def.melee) {
      for (const n of W.npcs) {
        if (n.dead) continue;
        const d = Utils.dist(ox, oy, n.x, n.y);
        if (d < def.range + 10 && Math.abs(Utils.angleDiff(Utils.angleTo(ox, oy, n.x, n.y) - angle)) < 1.2) {
          n.damage(def.dmg, team); this.spawnBlood(n.x, n.y, 5); break;
        }
      }
      for (const v of W.vehicles) {
        if (v.wrecked || v.driver === W.player) continue;
        if (Utils.dist(ox, oy, v.x, v.y) < def.range + v.radius * 0.6) { v.damage(def.dmg * 1.5, team); break; }
      }
      AudioSys.hit();
      return;
    }
    const pellets = def.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const ang = angle + Utils.rand(-def.spread, def.spread);
      this.bullets.push({ x: ox, y: oy, vx: Math.cos(ang) * def.bulletSpeed, vy: Math.sin(ang) * def.bulletSpeed, dmg: def.dmg, life: def.range / def.bulletSpeed, team: team });
    }
    AudioSys.shoot(weaponName);
    this.spawnMuzzle(ox, oy, angle);
    W.lastGunshot = { x: ox, y: oy, t: 0.5 };
    this.shake += weaponName === "rocket" ? 10 : weaponName === "shotgun" ? 4 : 1.5;
  },
  enemyShot(npc, spread) {
    const p = W.player;
    const ang = Utils.angleTo(npc.x, npc.y, p.x, p.y) + Utils.rand(-spread, spread);
    this.bullets.push({ x: npc.x + Math.cos(ang) * 14, y: npc.y + Math.sin(ang) * 14, vx: Math.cos(ang) * 700, vy: Math.sin(ang) * 700, dmg: 6 + Math.random() * 3, life: 0.9, team: "enemy" });
    AudioSys.shoot("pistol");
  },
  explode(x, y, r, dmg, team) {
    this.particles.push({ type: "flash", x: x, y: y, life: 0.16, r: r * 0.5, grav: 0 });
    if (window.Render3D && Render3D.flashFx) Render3D.flashFx(x, y, r);
    for (let i = 0; i < 14; i++) this.particles.push({ type: "fire", x: x + Utils.rand(-20, 20), y: y + Utils.rand(-20, 20), vx: Utils.rand(-160, 160), vy: Utils.rand(-220, -40), life: Utils.rand(0.4, 0.9), r: Utils.rand(10, 22), grav: -60 });
    for (let i = 0; i < 10; i++) this.particles.push({ type: "smoke", x: x + Utils.rand(-16, 16), y: y + Utils.rand(-16, 16), vx: Utils.rand(-60, 60), vy: Utils.rand(-120, -40), life: Utils.rand(1, 2), r: Utils.rand(12, 26), grav: -30 });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      this.particles.push({ type: "spark", x: x, y: y, vx: Math.cos(a) * Utils.rand(200, 500), vy: Math.sin(a) * Utils.rand(200, 500), life: Utils.rand(0.2, 0.5), r: 3, grav: 300 });
    }
    this.shake += r * 0.07;
    AudioSys.explosion();
    W.lastGunshot = { x: x, y: y, t: 0.5 };
    for (const n of W.npcs) {
      if (n.dead) continue;
      const d = Utils.dist(x, y, n.x, n.y);
      if (d < r + 8) n.damage(dmg * (1 - d / (r + 8)), team === "player" ? "player" : "explosion");
    }
    for (const v of W.vehicles) {
      if (v.wrecked) continue;
      const d = Utils.dist(x, y, v.x, v.y);
      if (d < r + v.radius) v.damage(dmg * (1 - d / (r + v.radius)), team === "player" ? "player" : "explosion");
    }
    if (!W.player.dead) {
      const tgt = W.player.vehicle || W.player;
      const rr = W.player.vehicle ? W.player.vehicle.radius : CFG.PLAYER.radius;
      const d = Utils.dist(x, y, tgt.x, tgt.y);
      if (d < r + rr) {
        if (W.player.vehicle) W.player.vehicle.damage(dmg * (1 - d / (r + rr)), "enemy");
        else W.player.damage(dmg * (1 - d / (r + rr)), "enemy");
      }
    }
  },
  spawnBlood(x, y, n) {
    for (let i = 0; i < n; i++) this.particles.push({ type: "blood", x: x, y: y, vx: Utils.rand(-90, 90), vy: Utils.rand(-120, 20), life: Utils.rand(0.4, 0.9), r: Utils.rand(2, 5), grav: 260 });
  },
  spawnSparks(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Utils.rand(0, Math.PI * 2);
      this.particles.push({ type: "spark", x: x, y: y, vx: Math.cos(a) * Utils.rand(80, 260), vy: Math.sin(a) * Utils.rand(80, 260), life: Utils.rand(0.15, 0.4), r: 2.5, grav: 400 });
    }
  },
  spawnMuzzle(x, y, ang) {
    this.particles.push({ type: "muzzle", x: x + Math.cos(ang) * 14, y: y + Math.sin(ang) * 14, vx: 0, vy: 0, life: 0.06, r: 7, grav: 0 });
  },
  spawnFire(x, y) {
    this.particles.push({ type: "fire", x: x, y: y, vx: Utils.rand(-20, 20), vy: Utils.rand(-90, -30), life: Utils.rand(0.3, 0.7), r: Utils.rand(8, 16), grav: -40 });
    if (Math.random() < 0.3) this.particles.push({ type: "smoke", x: x, y: y, vx: 0, vy: -40, life: Utils.rand(0.8, 1.6), r: Utils.rand(10, 18), grav: -20 });
  },
  draw(ctx) {
    for (const b of this.bullets) {
      ctx.strokeStyle = "rgba(255,220,80,0.9)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      ctx.stroke();
    }
    for (const p of this.particles) {
      const a = Utils.clamp(p.life / 0.5, 0, 1);
      ctx.globalAlpha = a;
      if (p.type === "blood") ctx.fillStyle = "#b91c1c";
      else if (p.type === "spark") ctx.fillStyle = "#fde047";
      else if (p.type === "smoke") ctx.fillStyle = "#64748b";
      else if (p.type === "fire") ctx.fillStyle = Utils.choice(["#f97316", "#f59e0b", "#ef4444"]);
      else if (p.type === "flash") ctx.fillStyle = "#fff7d6";
      else if (p.type === "muzzle") ctx.fillStyle = "#ffe08a";
      else ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (p.type === "smoke" ? 1 + (1 - a) : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};
