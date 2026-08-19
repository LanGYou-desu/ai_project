"use strict";
const PoliceSys = {
  init() {
    W.police = { level: 0, spawnCd: 0, loseTimer: 0, cars: [] };
  },
  addWanted(n) {
    const P = W.police;
    const old = P.level;
    P.level = Utils.clamp(P.level + n, 0, 5);
    if (W.player) W.player.wanted = P.level;
    if (P.level > old) {
      W.notify("通缉等级 " + "★".repeat(P.level), "#f87171");
      AudioSys.missionTick();
      if (P.level >= 1) AudioSys.sirenStart();
    } else if (P.level === 0) {
      AudioSys.sirenStop();
    }
  },
  update(dt) {
    const P = W.police, p = W.player;
    if (P.level <= 0) {
      if (P.cars.length) {
        for (const c of P.cars) this.removeSquad(c);
        P.cars = [];
      }
      return;
    }
    P.spawnCd -= dt;
    const interval = Math.max(1.2, 5.5 - P.level);
    const maxCars = Math.min(12, 2 + P.level * 2);
    if (P.spawnCd <= 0 && P.cars.length < maxCars) {
      P.spawnCd = interval * Utils.rand(0.7, 1.2);
      this.spawnSquad();
    }
    let anyNear = false;
    for (let i = P.cars.length - 1; i >= 0; i--) {
      const c = P.cars[i];
      if (c.v.wrecked) { this.removeSquad(c); P.cars.splice(i, 1); continue; }
      const d = Utils.dist(c.v.x, c.v.y, p.x, p.y);
      if (d < 1000) anyNear = true;
      if (d < 340 && c.officers.length === 0) this.deployOfficers(c);
      for (const o of c.officers) {
        if (o.dead) continue;
        if (o.state !== "attack") o.state = "attack";
        const dp = Utils.dist(o.x, o.y, p.x, p.y);
        if (!p.vehicle && dp < 30 && p.health < 30 && p.wanted > 0) { W.onPlayerBusted(); return; }
        if (!p.vehicle && dp < 44) {
          o.meleeCd -= dt;
          if (o.meleeCd <= 0) { o.meleeCd = 0.8; p.damage(8, "enemy"); AudioSys.hit(); }
        }
      }
    }
    if (!anyNear) {
      P.loseTimer += dt;
      if (P.loseTimer > CFG.POLICE.loseTime) { P.loseTimer = 0; this.addWanted(-1); }
    } else P.loseTimer = 0;
  },
  spawnSquad() {
    const p = W.player;
    const pt = this.edgePoint();
    const v = new Vehicle("police", pt.x, pt.y, Utils.angleTo(pt.x, pt.y, p.x, p.y), { siren: true });
    v.ai = makePoliceAI(v);
    W.vehicles.push(v);
    W.police.cars.push({ v: v, officers: [] });
    AudioSys.sirenStart();
  },
  edgePoint() {
    const d = MapSys.data;
    const r = Math.floor(Math.random() * 4);
    if (r === 0) return { x: Utils.choice(d.roadsV), y: 30 };
    if (r === 1) return { x: Utils.choice(d.roadsV), y: d.worldH - 30 };
    if (r === 2) return { x: 30, y: Utils.choice(d.roadsH) };
    return { x: d.worldW - 30, y: Utils.choice(d.roadsH) };
  },
  deployOfficers(c) {
    const v = c.v;
    const ang = v.heading;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const ox = v.x + Math.cos(ang + side * Math.PI / 2) * 22;
      const oy = v.y + Math.sin(ang + side * Math.PI / 2) * 22;
      const o = new NPC("police", ox, oy, { car: v, dropsMoney: false });
      o.state = "attack";
      W.npcs.push(o);
      c.officers.push(o);
    }
  },
  removeSquad(c) {
    for (const o of c.officers) {
      const i = W.npcs.indexOf(o);
      if (i >= 0) W.npcs.splice(i, 1);
    }
    const i = W.vehicles.indexOf(c.v);
    if (i >= 0) W.vehicles.splice(i, 1);
    c.officers = [];
  },
};
