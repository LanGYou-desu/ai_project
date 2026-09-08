"use strict";
// 车辆 AI。control() 每帧被调用，返回的驾驶指令对象由 AI 自身复用，避免每帧产生垃圾。
function makeTrafficAI(v, road) {
  const ctrl = { throttle: 0, steer: 0, brake: false, handbrake: false };
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
      ctrl.throttle = throttle; ctrl.steer = steer; ctrl.brake = false; ctrl.handbrake = false;
      return ctrl;
    },
  };
  return ai;
}
function makePoliceAI(v) {
  const ctrl = { throttle: 0, steer: 0, brake: false, handbrake: false };
  const ai = {
    police: true, hostile: true, stopped: false, escort: false,
    control(dt) {
      const p = W.player;
      if (!p || p.dead) {
        this.stopped = false;
        ctrl.throttle = 0; ctrl.steer = 0; ctrl.brake = true; ctrl.handbrake = false;
        return ctrl;
      }
      const d = Utils.dist(v.x, v.y, p.x, p.y);
      // 贴近后停车（此时警察下车步战）；玩家跑远后必须能重新追击，不能永久锁死
      if (d < 320) {
        this.stopped = true;
        ctrl.throttle = 0; ctrl.steer = 0; ctrl.brake = true; ctrl.handbrake = false;
        return ctrl;
      }
      this.stopped = false;
      const desired = Utils.angleTo(v.x, v.y, p.x, p.y);
      ctrl.throttle = 1;
      ctrl.steer = Utils.clamp(Utils.angleDiff(desired - v.heading) * 2.2, -1, 1);
      ctrl.brake = false; ctrl.handbrake = false;
      return ctrl;
    },
    onWreck() {},
  };
  return ai;
}
function makeEscortAI(v) {
  const ctrl = { throttle: 0, steer: 0, brake: false, handbrake: false };
  return {
    police: false, hostile: true, escort: true,
    control(dt) {
      const p = W.player;
      if (!p || p.dead) {
        ctrl.throttle = 0; ctrl.steer = 0; ctrl.brake = true; ctrl.handbrake = false;
        return ctrl;
      }
      const desired = Utils.angleTo(v.x, v.y, p.x, p.y);
      ctrl.throttle = 1;
      ctrl.steer = Utils.clamp(Utils.angleDiff(desired - v.heading) * 2.4, -1, 1);
      ctrl.brake = false; ctrl.handbrake = false;
      return ctrl;
    },
    onWreck() {},
  };
}
