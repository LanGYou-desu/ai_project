"use strict";
class Mission {
  constructor(def) {
    this.def = def;
    this.title = def.title; this.reward = def.reward;
    this.steps = def.steps(this);
    this.index = 0; this.done = false; this.failed = false; this.failReason = "";
    this.spawned = [];
    this.current = this.steps[0] || null;
    if (this.current && this.current.onStart) this.current.onStart(this);
  }
  update(dt) {
    if (!this.current || this.done || this.failed) return;
    const s = this.current;
    if (s.timeLeft !== undefined) {
      s.timeLeft -= dt;
      if (s.timeLeft <= 0) {
        if (s.survive) { this.advance(); return; }
        this.fail(s.timeFail || "时间耗尽！");
        return;
      }
    }
    if (s.condition && s.condition(this)) this.advance();
  }
  advance() {
    this.index++;
    this.current = this.steps[this.index] || null;
    if (this.current) {
      if (this.current.onStart) this.current.onStart(this);
      W.notify(this.current.text || "", "#fde68a");
      AudioSys.missionTick();
    } else this.complete();
  }
  complete() {
    this.done = true;
    W.player.money += this.reward;
    W.stats.moneyEarned += this.reward;
    W.notify("任务完成！奖励 +$" + this.reward, "#4ade80");
    AudioSys.missionDone();
    if (this.def.onComplete) this.def.onComplete();
    this.cleanup();
  }
  fail(reason) {
    if (this.done || this.failed) return;
    this.failed = true; this.failReason = reason;
    W.notify("任务失败：" + reason, "#f87171");
    AudioSys.missionFail();
    this.cleanup();
  }
  cleanup() {
    for (const e of this.spawned) {
      const vi = W.vehicles.indexOf(e);
      if (vi >= 0) {
        const v = W.vehicles[vi];
        if (v.driver === W.player) exitVehicle();
        W.vehicles.splice(vi, 1);
      }
      const ni = W.npcs.indexOf(e);
      if (ni >= 0) W.npcs.splice(ni, 1);
    }
    this.spawned = [];
  }
  spawnVehicle(type, x, y, heading, opts) {
    const v = new Vehicle(type, x, y, heading, opts);
    W.vehicles.push(v);
    this.spawned.push(v);
    return v;
  }
  spawnNPC(type, x, y, opts) {
    const n = new NPC(type, x, y, opts);
    W.npcs.push(n);
    this.spawned.push(n);
    return n;
  }
}
const Missions = {
  order: ["tutorial", "taxi", "rampage", "chase", "bomb", "boss", "finale"],
  defs: {}, current: null, completeCount: 0, taxiUnlocked: false,
  init() {
    this.defs = this.buildDefs();
    this.markers = this.order.map(id => {
      const d = this.defs[id];
      return { id: id, x: d.start.x, y: d.start.y };
    });
    this.taxiStand = MapSys.cellCenter(3, 7);
    this.doneIds = {};
  },
  buildDefs() {
    const cellC = (i, j) => MapSys.cellCenter(i, j);
    const ROAD = CFG.WORLD.road;
    return {
      tutorial: {
        title: "新手上路", reward: 300,
        start: cellC(1, 0),
        steps(m) {
          const sedan = { ref: null };
          const g = cellC(1, 0);
          return [
            { text: "走到车库（黄色标记）", marker: { x: g.x, y: g.y, color: "#facc15" },
              onStart(m2) {
                const sp = MapSys.walkableNear(g.x, g.y, 70);
                sedan.ref = m2.spawnVehicle("sedan", sp.x, sp.y, 0);
                this.marker = { x: sp.x, y: sp.y, color: "#facc15" };
              },
              condition() { return Utils.dist(W.player.x, W.player.y, this.marker.x, this.marker.y) < 70; } },
            { text: "按 E 进入轿车", marker: { x: g.x, y: g.y, color: "#38bdf8" },
              condition() { return W.player.vehicle === sedan.ref; } },
            { text: "驾车穿过 3 个检查点", type: "drive", points: [{ x: 960, y: 320 }, { x: 1920, y: 960 }, { x: 960, y: 1600 }], idx: 0,
              marker: { x: 960, y: 320, color: "#38bdf8" },
              condition() {
                if (!W.player.vehicle) return false;
                const pts = this.points;
                if (Utils.dist(W.player.x, W.player.y, pts[this.idx].x, pts[this.idx].y) < 60) {
                  this.idx++;
                  if (this.idx >= pts.length) return true;
                  this.marker = { x: pts[this.idx].x, y: pts[this.idx].y, color: "#38bdf8" };
                  W.notify("检查点 " + this.idx + "/" + pts.length, "#38bdf8");
                }
                return false;
              } },
            { text: "开回医院（起点）", marker: { x: 160, y: 160, color: "#4ade80" },
              condition() { return Utils.dist(W.player.x, W.player.y, 160, 160) < 90; } },
          ];
        },
      },
      taxi: {
        title: "城市出租", reward: 600,
        start: cellC(3, 7),
        steps(m) {
          const wl = (pt) => MapSys.walkableNear(pt.x, pt.y, 90);
          const jobs = [
            { p: wl(cellC(2, 4)), d: wl(cellC(8, 9)) },
            { p: wl(cellC(9, 6)), d: wl(cellC(4, 3)) },
            { p: wl(cellC(6, 9)), d: wl(cellC(3, 2)) },
          ];
          const arr = [];
          for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i];
            arr.push({ text: "接到乘客 " + (i + 1) + "（需驾车）", marker: { x: job.p.x, y: job.p.y, color: "#22c55e" },
              condition() { return !!W.player.vehicle && Utils.dist(W.player.x, W.player.y, job.p.x, job.p.y) < 60; } });
            arr.push({ text: "送乘客 " + (i + 1) + " 到目的地", marker: { x: job.d.x, y: job.d.y, color: "#4ade80" },
              timeLeft: 50, timeFail: "乘客等不及下车了！",
              condition() { return !!W.player.vehicle && Utils.dist(W.player.x, W.player.y, job.d.x, job.d.y) < 60; } });
          }
          return arr;
        },
      },
      rampage: {
        title: "帮派清剿", reward: 1200,
        start: cellC(9, 9),
        steps(m) {
          const c = cellC(9, 9);
          return [
            { text: "消灭 20 名帮派成员", type: "kill", count: 20, killed: 0, timeLeft: 240, timeFail: "帮派逃走了！",
              marker: { x: c.x, y: c.y, color: "#f87171" },
              onStart(m2) {
                W.player.ammo.smg += 300;
                W.player.mag.smg = CFG.WEAPONS.smg.mag;
                for (let i = 0; i < 24; i++) m2.spawnNPC("gang", c.x + Utils.rand(-160, 160), c.y + Utils.rand(-160, 160));
                W.notify("冲锋枪弹药已补充", "#fbbf24");
              },
              condition() { return this.killed >= this.count; } },
          ];
        },
      },
      chase: {
        title: "追捕逃犯", reward: 1800,
        start: cellC(9, 3),
        steps(m) {
          const road = { x: 9 * CFG.WORLD.cell, y: 3 * CFG.WORLD.cell };
          let target = null;
          return [
            { text: "追上并摧毁逃跑的红色跑车", type: "destroy", tag: "target", timeLeft: 200, timeFail: "目标逃脱了！",
              marker: { x: road.x, y: road.y, color: "#f87171" },
              onStart(m2) {
                const v = m2.spawnVehicle("sports", road.x, road.y, 0, { tag: "target" });
                v.color = "#dc2626";
                const rp = MapSys.randomRoadPoint();
                v.ai = makeTrafficAI(v, { axis: rp.axis, x: rp.x, y: rp.y, dir: rp.dir, lane: rp.lane });
                v.ai.cruise = v.def.maxSpeed * 0.72;
                v.health = 420;
                target = v;
                this.targetRef = v;
              },
              condition() { return target ? target.wrecked : true; } },
          ];
        },
      },
      bomb: {
        title: "定时炸弹", reward: 2500,
        start: cellC(2, 11),
        steps(m) {
          const depot = cellC(2, 11);
          const site = MapSys.walkableNear(cellC(10, 10).x, cellC(10, 10).y, 90);
          let van = null;
          return [
            { text: "驾驶炸弹卡车到目标地点（90 秒）", type: "deliver", timeLeft: 90, timeFail: "炸弹爆炸了！",
              marker: { x: depot.x, y: depot.y, color: "#facc15" },
              onStart(m2) { van = m2.spawnVehicle("truck", depot.x, depot.y, 0, { tag: "van" }); this.vanRef = van; },
              condition() {
                if (W.player.vehicle !== van) { this.marker = { x: depot.x, y: depot.y, color: "#facc15" }; return false; }
                if (Utils.dist(van.x, van.y, site.x, site.y) < 70) return true;
                this.marker = { x: site.x, y: site.y, color: "#f87171" };
                return false;
              } },
            { text: "逃离警察追捕（60 秒）", type: "survive", survive: true, timeLeft: 60,
              onStart() { W.addWanted(3); W.notify("引爆完成！快逃！", "#f87171"); },
              onEnd() { W.addWanted(-5); },
              condition() { return this.timeLeft <= 0; } },
          ];
        },
      },
      boss: {
        title: "枭雄陨落", reward: 4000,
        start: cellC(5, 10),
        steps(m) {
          const c = cellC(5, 10);
          return [
            { text: "干掉帮派老大（4 名保镖）", type: "kill", targetTag: "boss", count: 1, killed: 0,
              marker: { x: c.x, y: c.y, color: "#f87171" },
              onStart(m2) {
                m2.spawnNPC("boss", c.x, c.y, { tag: "boss" });
                for (let i = 0; i < 4; i++) {
                  m2.spawnNPC("gang", c.x + Math.cos(i / 4 * Math.PI * 2) * 90, c.y + Math.sin(i / 4 * Math.PI * 2) * 90);
                }
              },
              condition() { return this.killed >= this.count; } },
          ];
        },
      },
      finale: {
        title: "终极对决", reward: 8000,
        start: cellC(1, 9),
        steps(m) {
          const rd = { x: 1 * CFG.WORLD.cell, y: 9 * CFG.WORLD.cell };
          return [
            { text: "摧毁护送车队（3 辆卡车 + 2 辆护卫）", type: "destroy", tag: "convoy", timeLeft: 300, timeFail: "车队逃走了！",
              marker: { x: rd.x, y: rd.y, color: "#f87171" },
              onStart(m2) {
                W.player.ammo.rocket += 12;
                W.player.mag.rocket = CFG.WEAPONS.rocket.mag;
                W.notify("火箭筒弹药已补充！", "#fbbf24");
                let x = rd.x;
                for (let i = 0; i < 3; i++) {
                  const t = m2.spawnVehicle("truck", x, rd.y, 0, { tag: "convoyT" + i });
                  t.ai = makeTrafficAI(t, { axis: "v", x: x, y: rd.y, dir: -1, lane: -ROAD / 4 });
                  t.ai.cruise = t.def.maxSpeed * 0.5;
                  t.health = 900;
                  x += 260;
                }
                for (let i = 0; i < 2; i++) {
                  const e = m2.spawnVehicle("sports", x + i * 180, rd.y, 0, { tag: "convoyE" + i });
                  e.ai = makeEscortAI(e);
                  e.color = "#111827";
                }
              },
              condition() {
                let left = 0;
                for (const e of m.spawned) {
                  if (e instanceof Vehicle && e.tag && e.tag.indexOf("convoyT") === 0 && !e.wrecked) left++;
                }
                return left === 0;
              } },
          ];
        },
        onComplete() { W.notify("恭喜通关！你成为了亡命都市的新传奇。", "#facc15"); },
      },
    };
  },
  buildTaxiDef() {
    const cellC = (i, j) => MapSys.cellCenter(i, j);
    const wl = (pt) => MapSys.walkableNear(pt.x, pt.y, 90);
    const jobs = [
      { p: wl(cellC(2, 4)), d: wl(cellC(8, 9)) },
      { p: wl(cellC(9, 6)), d: wl(cellC(4, 3)) },
      { p: wl(cellC(6, 9)), d: wl(cellC(3, 2)) },
    ];
    const arr = [];
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      arr.push({ text: "接到乘客 " + (i + 1) + "（需驾车）", marker: { x: job.p.x, y: job.p.y, color: "#22c55e" },
        condition() { return !!W.player.vehicle && Utils.dist(W.player.x, W.player.y, job.p.x, job.p.y) < 60; } });
      arr.push({ text: "送乘客 " + (i + 1) + " 到目的地", marker: { x: job.d.x, y: job.d.y, color: "#4ade80" },
        timeLeft: 50, timeFail: "乘客等不及下车了！",
        condition() { return !!W.player.vehicle && Utils.dist(W.player.x, W.player.y, job.d.x, job.d.y) < 60; } });
    }
    return { title: "出租车生意", reward: 150 * jobs.length, steps() { return arr; } };
  },
  tryStart(x, y) {
    if (this.current || W.player.vehicle) return false;
    for (const mk of this.markers) {
      if (Utils.dist(x, y, mk.x, mk.y) < 60) { this.start(mk.id); return true; }
    }
    if (this.taxiUnlocked && Utils.dist(x, y, this.taxiStand.x, this.taxiStand.y) < 60) { this.startTaxi(); return true; }
    return false;
  },
  start(id) {
    this.current = new Mission(this.defs[id]);
    this.current.defId = id;
    W.notify("任务开始：" + this.current.title, "#fde68a");
    AudioSys.missionStart();
  },
  startTaxi() {
    this.current = new Mission(this.buildTaxiDef());
    W.notify("任务开始：" + this.current.title, "#fde68a");
    AudioSys.missionStart();
  },
  update(dt) {
    if (!this.current) return;
    this.current.update(dt);
    if (this.current.done) {
      const id = this.current.defId;
      if (id && this.order.indexOf(id) >= 0) {
        this.completeCount++;
        this.doneIds[id] = true;
      }
      this.current = null;
      if (this.completeCount >= 7) W.notify("剧情完成！进入自由模式", "#facc15");
    } else if (this.current.failed) {
      this.current = null;
    }
  },
  onNpcKilled(n) {
    if (!this.current) return;
    const s = this.current.current;
    if (!s || s.type !== "kill") return;
    if (n.gang) s.killed++;
    if (s.targetTag && n.tag === s.targetTag) s.killed++;
    if (s.killed > s.count) s.killed = s.count;
  },
  onPlayerDied() {
    if (this.current) this.current.fail("你被击倒了");
  },
  drawWorld(ctx) {
    const t = W.gameTime * 2;
    if (this.current) {
      const s = this.current.current;
      if (s && s.marker) {
        if (s.targetRef) { s.marker.x = s.targetRef.x; s.marker.y = s.targetRef.y; }
        drawBlip(ctx, s.marker.x, s.marker.y, s.marker.color, t, null);
      }
      return;
    }
    for (const mk of this.markers) {
      if (this.doneIds[mk.id]) continue;
      drawBlip(ctx, mk.x, mk.y, "#facc15", t, "?");
    }
    if (this.taxiUnlocked) drawBlip(ctx, this.taxiStand.x, this.taxiStand.y, "#22c55e", t, "T");
  },
};
