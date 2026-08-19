"use strict";
function makeTrafficAI(v, road) {
  const ai = {
    road: road,
    cruise: v.def.maxSpeed * Utils.rand(0.45, 0.62),
    hostile: false,
    control(dt) {
      const cell = CFG.WORLD.cell, roadW = CFG.WORLD.road;
      const r = this.road;
      let desired;
      if (r.axis === "v") desired = r.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      else desired = r.dir > 0 ? 0 : Math.PI;
      let tx, ty;
      if (r.axis === "v") { tx = r.x + r.lane; ty = v.y; }
      else { tx = v.x; ty = r.y + r.lane; }
      desired = Utils.angleLerp(desired, Utils.angleTo(v.x, v.y, tx, ty), 3 * dt);
      const ax = Math.round(v.x / cell) * cell, ay = Math.round(v.y / cell) * cell;
      if (Math.abs(v.x - ax) < 14 && Math.abs(v.y - ay) < 14) {
        if (Math.random() < dt * 0.9 && Math.random() < 0.3) {
          const dir = Math.random() < 0.5 ? 1 : -1;
          const lane = dir * roadW / 4;
          if (r.axis === "h") this.road = { axis: "v", x: ax, y: ay, dir: dir, lane: lane };
          else this.road = { axis: "h", x: ax, y: ay, dir: dir, lane: lane };
        }
      }
      const steer = Utils.clamp(Utils.angleDiff(desired - v.heading) * 2.5, -1, 1);
      let throttle = this.cruise > v.fs ? 1 : 0.1;
      const p = W.player;
      if (p && p.vehicle) {
        const d = Utils.dist(v.x, v.y, p.vehicle.x, p.vehicle.y);
        if (d < 80) throttle = 0;
      }
      const fx = Math.cos(v.heading), fy = Math.sin(v.heading);
      for (const o of W.vehicles) {
        if (o === v || o.wrecked || o.ai === this) continue;
        const dx = o.x - v.x, dy = o.y - v.y;
        const ahead = dx * fx + dy * fy;
        if (ahead > 0 && ahead < 110) {
          const side = Math.abs(dx * fy - dy * fx);
          if (side < 46) { throttle = 0; break; }
        }
      }
      return { throttle: throttle, steer: steer, brake: false, handbrake: false };
    },
  };
  return ai;
}
function makePoliceAI(v) {
  const ai = {
    police: true, hostile: true, stopped: false, escort: false,
    control(dt) {
      const p = W.player;
      if (!p || p.dead || this.stopped) return { throttle: 0, steer: 0, brake: true };
      const d = Utils.dist(v.x, v.y, p.x, p.y);
      if (d < 320) { this.stopped = true; return { throttle: 0, steer: 0, brake: true }; }
      const desired = Utils.angleTo(v.x, v.y, p.x, p.y);
      const steer = Utils.clamp(Utils.angleDiff(desired - v.heading) * 2.2, -1, 1);
      return { throttle: 1, steer: steer, brake: false, handbrake: false };
    },
    onWreck() {},
  };
  return ai;
}
function makeEscortAI(v) {
  return {
    police: false, hostile: true, escort: true,
    control(dt) {
      const p = W.player;
      if (!p || p.dead) return { throttle: 0, steer: 0, brake: true };
      const desired = Utils.angleTo(v.x, v.y, p.x, p.y);
      const steer = Utils.clamp(Utils.angleDiff(desired - v.heading) * 2.4, -1, 1);
      return { throttle: 1, steer: steer, brake: false, handbrake: false };
    },
    onWreck() {},
  };
}
